export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { guardTenantVerificationEnabled } from "@/lib/tenant-verification-config";
import { z } from "zod";

const familyMemberSchema = z.object({
  fullName: z.string().min(1, "Name is required"),
  relation: z.string().min(1, "Relationship is required"),
  age: z.number().optional().nullable(),
  idProof: z.string().optional().or(z.literal("")).optional(),
});

const updateFamilyMemberSchema = z.object({
  id: z.string(),
  fullName: z.string().min(1),
  relation: z.string().min(1),
  age: z.number().optional().nullable(),
  idProof: z.string().optional().or(z.literal("")).optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const disabled = await guardTenantVerificationEnabled();
  if (disabled) return disabled;

  const { id } = await params;

  const family = await prisma.tenantFamilyMember.findMany({
    where: { applicationId: id },
    orderBy: { createdAt: "asc" as const },
    select: {
      id: true,
      fullName: true,
      relation: true,
      age: true,
      idProof: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ family });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const disabled = await guardTenantVerificationEnabled();
  if (disabled) return disabled;

  const { id } = await params;
  const userId = String((session.user as any).id ?? "");

  // Check ownership
  const application = await prisma.tenantApplication.findUnique({
    where: { id },
    select: { id: true, status: true, residentId: true, tenantEmail: true, tenantPhone: true },
  });

  if (!application) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const url = new URL(req.url);
  const phoneParam = url.searchParams.get("phone");
  const userEmail = (session.user as any).email as string | undefined;

  const ownsApplication =
    application.residentId === userId ||
    application.tenantEmail === userEmail ||
    application.tenantPhone === phoneParam;

  if (!ownsApplication) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Only PENDING applications can be edited
  if (application.status !== "PENDING") {
    return NextResponse.json(
      { error: "Only draft applications can be edited" },
      { status: 409 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = familyMemberSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { fullName, relation, age, idProof } = parsed.data;

  const member = await prisma.tenantFamilyMember.create({
    data: {
      applicationId: id,
      fullName,
      relation,
      age: age ?? null,
      idProof: idProof || null,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId,
      action: "CREATE",
      entity: "TenantFamilyMember",
      entityId: member.id,
      meta: { applicationId: id, fullName, relation },
    },
  });

  return NextResponse.json({ member }, { status: 201 });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const disabled = await guardTenantVerificationEnabled();
  if (disabled) return disabled;

  const { id } = await params;
  const userId = String((session.user as any).id ?? "");

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = updateFamilyMemberSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { id: memberId, fullName, relation, age, idProof } = parsed.data;

  // Check ownership through application
  const member = await prisma.tenantFamilyMember.findUnique({
    where: { id: memberId },
    select: {
      id: true,
      applicationId: true,
      application: {
        select: {
          id: true,
          status: true,
          residentId: true,
          tenantEmail: true,
          tenantPhone: true,
        },
      },
    },
  });

  if (!member) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const url = new URL(req.url);
  const phoneParam = url.searchParams.get("phone");
  const userEmail = (session.user as any).email as string | undefined;

  const ownsApplication =
    member.application.residentId === userId ||
    member.application.tenantEmail === userEmail ||
    member.application.tenantPhone === phoneParam;

  if (!ownsApplication) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (member.application.status !== "PENDING") {
    return NextResponse.json(
      { error: "Only draft applications can be edited" },
      { status: 409 }
    );
  }

  const updated = await prisma.tenantFamilyMember.update({
    where: { id: memberId },
    data: {
      fullName,
      relation,
      age: age ?? null,
      idProof: idProof || null,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId,
      action: "UPDATE",
      entity: "TenantFamilyMember",
      entityId: memberId,
      meta: { applicationId: id, fullName, relation },
    },
  });

  return NextResponse.json({ member: updated });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const disabled = await guardTenantVerificationEnabled();
  if (disabled) return disabled;

  const { id } = await params;
  const userId = String((session.user as any).id ?? "");

  const url = new URL(req.url);
  const memberId = url.searchParams.get("memberId");
  const phoneParam = url.searchParams.get("phone");

  if (!memberId) {
    return NextResponse.json({ error: "memberId is required" }, { status: 400 });
  }

  // Check ownership through application
  const member = await prisma.tenantFamilyMember.findUnique({
    where: { id: memberId },
    select: {
      id: true,
      applicationId: true,
      application: {
        select: {
          id: true,
          status: true,
          residentId: true,
          tenantEmail: true,
          tenantPhone: true,
        },
      },
    },
  });

  if (!member) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const userEmail = (session.user as any).email as string | undefined;

  const ownsApplication =
    member.application.residentId === userId ||
    member.application.tenantEmail === userEmail ||
    member.application.tenantPhone === phoneParam;

  if (!ownsApplication) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (member.application.status !== "PENDING") {
    return NextResponse.json(
      { error: "Only draft applications can be edited" },
      { status: 409 }
    );
  }

  await prisma.tenantFamilyMember.delete({
    where: { id: memberId },
  });

  await prisma.auditLog.create({
    data: {
      userId,
      action: "DELETE",
      entity: "TenantFamilyMember",
      entityId: memberId,
      meta: { applicationId: id },
    },
  });

  return NextResponse.json({ success: true });
}

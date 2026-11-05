export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { guardPermission } from "@/lib/permissions";
import { guardTenantVerificationEnabled } from "@/lib/tenant-verification-config";
import { isValidTransition } from "@/lib/tenant-verification";
import { z } from "zod";
import { TenantApplicationStatus } from "@prisma/client";

const updateApplicationSchema = z.object({
  tenantName: z.string().trim().min(1).max(200).optional(),
  tenantPhone: z.string().trim().min(1).max(20).optional(),
  tenantEmail: z.string().email().optional().nullable(),
  tenantIdProof: z.string().trim().min(1).max(100).optional().nullable(),
  moveInDate: z.string().datetime().optional().nullable(),
  moveOutDate: z.string().datetime().optional().nullable(),
  status: z.nativeEnum(TenantApplicationStatus).optional(),
  ownerApprovedBy: z.string().optional().nullable(),
  managementApprovedBy: z.string().optional().nullable(),
  policeVerificationRef: z.string().optional().nullable(),
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
  const role = (session.user as any).role as string;
  const userId = String((session.user as any).id ?? "");

  const application = await prisma.tenantApplication.findUnique({
    where: { id },
    include: {
      resident: { include: { user: true } },
      connection: { select: { id: true, flatNo: true, tower: true } },
      documents: { orderBy: { createdAt: "asc" as const } },
      family: { orderBy: { createdAt: "asc" as const } },
      auditLogs: {
        orderBy: { createdAt: "desc" as const },
        include: { user: { select: { id: true, name: true, email: true } } },
      },
    },
  });

  if (!application) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (role === "RESIDENT") {
    const resident = await prisma.resident.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!resident || resident.id !== application.residentId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  } else if (role === "ADMIN" || role === "MANAGER") {
    const guard = await guardPermission(
      session as any,
      "tenant-verification",
      "canRead"
    );
    if (guard) return guard;
  } else {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({ application });
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
  const role = (session.user as any).role as string;
  const userId = String((session.user as any).id ?? "");

  if (role !== "ADMIN" && role !== "MANAGER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const guard = await guardPermission(
    session as any,
    "tenant-verification",
    "canWrite"
  );
  if (guard) return guard;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = updateApplicationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const data = parsed.data;
  const application = await prisma.tenantApplication.findUnique({
    where: { id },
    select: { id: true, status: true, residentId: true },
  });
  if (!application) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updateData: any = {};
  if (data.tenantName !== undefined) updateData.tenantName = data.tenantName;
  if (data.tenantPhone !== undefined) updateData.tenantPhone = data.tenantPhone;
  if (data.tenantEmail !== undefined) updateData.tenantEmail = data.tenantEmail;
  if (data.tenantIdProof !== undefined) updateData.tenantIdProof = data.tenantIdProof;
  if (data.moveInDate !== undefined)
    updateData.moveInDate = data.moveInDate ? new Date(data.moveInDate) : null;
  if (data.moveOutDate !== undefined)
    updateData.moveOutDate = data.moveOutDate ? new Date(data.moveOutDate) : null;
  if (data.ownerApprovedBy !== undefined)
    updateData.ownerApprovedBy = data.ownerApprovedBy;
  if (data.managementApprovedBy !== undefined)
    updateData.managementApprovedBy = data.managementApprovedBy;
  if (data.policeVerificationRef !== undefined)
    updateData.policeVerificationRef = data.policeVerificationRef;

  if (data.status !== undefined) {
    if (!isValidTransition(application.status, data.status)) {
      return NextResponse.json(
        { error: `Invalid status transition from ${application.status} to ${data.status}` },
        { status: 409 }
      );
    }
    updateData.status = data.status;

    const now = new Date();
    switch (data.status) {
      case "OWNER_APPROVED":
        updateData.ownerApprovedAt = now;
        updateData.ownerApprovedBy = data.ownerApprovedBy ?? userId;
        break;
      case "MANAGEMENT_APPROVED":
        updateData.managementApprovedAt = now;
        updateData.managementApprovedBy = data.managementApprovedBy ?? userId;
        break;
      case "POLICE_VERIFIED":
        updateData.policeVerifiedAt = now;
        break;
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    const app = await tx.tenantApplication.update({
      where: { id },
      data: updateData,
    });

    if (data.status !== undefined && data.status !== application.status) {
      await tx.auditLog.create({
        data: {
          userId,
          action: "STATUS_CHANGE",
          entity: "TenantApplication",
          entityId: id,
          meta: {
            fromStatus: application.status,
            toStatus: data.status,
            applicationNumber: app.applicationNumber,
          },
        },
      });
    }

    return app;
  });

  return NextResponse.json({ application: updated });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const disabled = await guardTenantVerificationEnabled();
  if (disabled) return disabled;

  const { id } = await params;
  const role = (session.user as any).role as string;

  if (role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const guard = await guardPermission(
    session as any,
    "tenant-verification",
    "canDelete"
  );
  if (guard) return guard;

  const application = await prisma.tenantApplication.findUnique({
    where: { id },
    select: { id: true, status: true },
  });
  if (!application) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.$transaction(async (tx) => {
    await tx.tenantApplicationAudit.deleteMany({ where: { applicationId: id } });
    await tx.tenantDocument.deleteMany({ where: { applicationId: id } });
    await tx.tenantFamilyMember.deleteMany({ where: { applicationId: id } });
    await tx.tenantApplication.delete({ where: { id } });

    await tx.auditLog.create({
      data: {
        userId: String((session.user as any).id ?? ""),
        action: "DELETE",
        entity: "TenantApplication",
        entityId: id,
        meta: { status: application.status },
      },
    });
  });

  return NextResponse.json({ success: true });
}

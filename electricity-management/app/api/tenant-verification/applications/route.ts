export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { guardPermission } from "@/lib/permissions";
import { guardTenantVerificationEnabled } from "@/lib/tenant-verification-config";
import {
  nextTenantApplicationNumber,
  generateApplicationToken,
} from "@/lib/tenant-verification";
import { z } from "zod";

const createApplicationSchema = z.object({
  residentId: z.string().min(1).optional(),
  connectionId: z.string().min(1).optional(),
  tenantName: z.string().trim().min(1).max(200),
  tenantPhone: z.string().trim().min(1).max(20),
  tenantEmail: z.string().email().optional().nullable(),
  tenantIdProof: z.string().trim().min(1).max(100).optional().nullable(),
  moveInDate: z.string().datetime().optional().nullable(),
  moveOutDate: z.string().datetime().optional().nullable(),
  description: z.string().trim().max(2000).optional().nullable(),
});

const applicationInclude = {
  resident: {
    include: {
      user: { select: { id: true, name: true, email: true, phone: true } },
    },
  },
  connection: { select: { id: true, flatNo: true, tower: true } },
  documents: {
    orderBy: { createdAt: "asc" as const },
    select: {
      id: true,
      documentType: true,
      fileName: true,
      mimeType: true,
      sizeBytes: true,
      verified: true,
      verifiedBy: true,
      verifiedAt: true,
      createdAt: true,
      uploadedBy: true,
    },
  },
  family: {
    orderBy: { createdAt: "asc" as const },
    select: {
      id: true,
      fullName: true,
      relation: true,
      age: true,
      idProof: true,
      createdAt: true,
    },
  },
  _count: { select: { documents: true, family: true, auditLogs: true } },
} as const;

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const disabled = await guardTenantVerificationEnabled();
  if (disabled) return disabled;

  const role = (session.user as any).role as string;
  const userId = String((session.user as any).id ?? "");

  const where: any = {};

  if (role === "RESIDENT") {
    const resident = await prisma.resident.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!resident) return NextResponse.json({ applications: [] });
    where.residentId = resident.id;
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

  const url = new URL(req.url);
  const search = url.searchParams.get("search")?.trim();
  const statusParam = url.searchParams.get("status")?.trim();

  if (search) {
    where.OR = [
      { applicationNumber: { contains: search } },
      { tenantName: { contains: search } },
      { tenantPhone: { contains: search } },
      { connection: { flatNo: { contains: search } } },
      { connection: { tower: { contains: search } } },
      { resident: { user: { name: { contains: search } } } },
    ];
  }

  if (statusParam) {
    where.status = statusParam as any;
  }

  let applications: any[];
  try {
    applications = await prisma.tenantApplication.findMany({
      where,
      include: applicationInclude as any,
      orderBy: { updatedAt: "desc" },
      take: 500,
    });
  } catch (error: any) {
    console.error("Tenant Verification applications GET error:", error?.message ?? error);
    return NextResponse.json(
      { error: "Could not load applications: " + (error?.message ?? "unknown") },
      { status: 500 }
    );
  }

  return NextResponse.json({ applications });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const disabled = await guardTenantVerificationEnabled();
  if (disabled) return disabled;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createApplicationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const data = parsed.data;
  const user = session.user as { id: string; role?: string };
  const role = user.role;

  let residentId = data.residentId ?? null;

  if (role === "RESIDENT") {
    const ownResident = await prisma.resident.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });
    if (!ownResident) {
      return NextResponse.json({ error: "Resident profile not found" }, { status: 404 });
    }
    residentId = ownResident.id;
  } else {
    if (!residentId) {
      return NextResponse.json({ error: "Select Resident is required" }, { status: 400 });
    }
    const guard = await guardPermission(
      session as any,
      "tenant-verification",
      "canWrite"
    );
    if (guard) return guard;
  }

  const resident = await prisma.resident.findUnique({
    where: { id: residentId },
    select: { id: true },
  });
  if (!resident) return NextResponse.json({ error: "Resident not found" }, { status: 404 });

  let connectionId = data.connectionId ?? null;
  if (connectionId) {
    const owned = await prisma.connection.findFirst({
      where: { id: connectionId, residentId },
      select: { id: true },
    });
    if (!owned) {
      return NextResponse.json(
        { error: "Location does not belong to the selected resident" },
        { status: 400 }
      );
    }
  } else {
    const connections = await prisma.connection.findMany({
      where: { residentId },
      select: { id: true, flatNo: true, tower: true },
      orderBy: { flatNo: "asc" },
    });
    if (connections.length === 1) {
      connectionId = connections[0].id;
    } else if (connections.length > 1) {
      return NextResponse.json({ error: "Select a location for the application" }, { status: 400 });
    }
  }

  const applicationNumber = await nextTenantApplicationNumber();
  const applicationToken = generateApplicationToken();

  const application = await prisma.$transaction(async (tx) => {
    const created = await tx.tenantApplication.create({
      data: {
        applicationNumber,
        residentId: residentId!,
        connectionId,
        tenantName: data.tenantName,
        tenantPhone: data.tenantPhone,
        tenantEmail: data.tenantEmail ?? null,
        tenantIdProof: data.tenantIdProof ?? null,
        moveInDate: data.moveInDate ? new Date(data.moveInDate) : null,
        moveOutDate: data.moveOutDate ? new Date(data.moveOutDate) : null,
        status: "PENDING",
        applicationToken,
        otpVerified: false,
      },
      include: applicationInclude as any,
    });

    await tx.auditLog.create({
      data: {
        userId: user.id,
        action: "CREATE",
        entity: "TenantApplication",
        entityId: created.id,
        meta: {
          applicationNumber,
          residentId: residentId,
          connectionId,
        },
      },
    });

    return created;
  });

  return NextResponse.json({ application }, { status: 201 });
}

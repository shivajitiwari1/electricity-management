export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { guardTenantVerificationEnabled } from "@/lib/tenant-verification-config";
import { z } from "zod";

const updateDraftSchema = z.object({
  tenantName: z.string().min(1).optional(),
  tenantPhone: z.string().min(10).optional(),
  tenantEmail: z.string().email().optional().or(z.literal("")).optional(),
  moveInDate: z.string().datetime().optional().nullable(),
  tenancyFrom: z.string().datetime().optional().nullable(),
  tenancyTo: z.string().datetime().optional().nullable(),
  permanentAddress: z.string().optional().or(z.literal("")).optional(),
  fatherSpouseName: z.string().optional().or(z.literal("")).optional(),
  dateOfBirth: z.string().datetime().optional().nullable(),
  occupation: z.string().optional().or(z.literal("")).optional(),
  employer: z.string().optional().or(z.literal("")).optional(),
  officeAddress: z.string().optional().or(z.literal("")).optional(),
  nationality: z.string().optional().or(z.literal("")).optional(),
  maritalStatus: z.string().optional().or(z.literal("")).optional(),
  idProofType: z.string().optional().or(z.literal("")).optional(),
  idProofLast4: z.string().optional().or(z.literal("")).optional(),
  policeStatus: z.string().optional().or(z.literal("")).optional(),
  policeRefNumber: z.string().optional().or(z.literal("")).optional(),
  policeRefDate: z.string().datetime().optional().nullable(),
  previousAddress: z.string().optional().or(z.literal("")).optional(),
  emergencyContactName: z.string().optional().or(z.literal("")).optional(),
  emergencyContactRelation: z.string().optional().or(z.literal("")).optional(),
  emergencyContactMobile: z.string().optional().or(z.literal("")).optional(),
  flatId: z.string().optional(),
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
  const userId = String((session.user as any).id ?? "");
  const userEmail = (session.user as any).email as string | undefined;
  const url = new URL(_req.url);
  const phoneParam = url.searchParams.get("phone");

  const application = await prisma.tenantApplication.findUnique({
    where: { id },
    include: {
      documents: {
        orderBy: { createdAt: "asc" as const },
        select: {
          id: true,
          documentType: true,
          fileName: true,
          mimeType: true,
          sizeBytes: true,
          verified: true,
          createdAt: true,
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
      vehicles: {
        orderBy: { createdAt: "asc" as const },
        select: {
          id: true,
          vehicleType: true,
          registrationNo: true,
          stickerRfidNo: true,
          createdAt: true,
        },
      },
    },
  });

  if (!application) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Ownership check: applicant must own this application
  const ownsApplication =
    application.residentId === userId ||
    application.tenantEmail === userEmail ||
    application.tenantPhone === phoneParam;

  if (!ownsApplication) {
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
  const userId = String((session.user as any).id ?? "");
  const userEmail = (session.user as any).email as string | undefined;
  const url = new URL(req.url);
  const phoneParam = url.searchParams.get("phone");

  // Check ownership first
  const existing = await prisma.tenantApplication.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      residentId: true,
      connectionId: true,
      tenantEmail: true,
      tenantPhone: true,
    },
  });

  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const ownsApplication =
    existing.residentId === userId ||
    existing.tenantEmail === userEmail ||
    existing.tenantPhone === phoneParam;

  if (!ownsApplication) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Only DRAFT applications can be edited
  if (existing.status !== "PENDING") {
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

  const parsed = updateDraftSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const data = parsed.data;

  // If changing flat, verify it exists
  let connectionId = existing.connectionId;
  let tower = undefined;
  let flatNo = undefined;
  let residentId = existing.residentId;

  if (data.flatId && data.flatId !== existing.connectionId) {
    const connection = await prisma.connection.findUnique({
      where: { id: data.flatId },
      select: { id: true, flatNo: true, tower: true, residentId: true },
    });
    if (!connection) {
      return NextResponse.json({ error: "Flat not found" }, { status: 404 });
    }
    connectionId = connection.id;
    tower = connection.tower;
    flatNo = connection.flatNo;
    residentId = connection.residentId;
  }

  // Validate date order
  if (data.tenancyFrom && data.tenancyTo) {
    if (new Date(data.tenancyFrom) > new Date(data.tenancyTo)) {
      return NextResponse.json(
        { error: "Tenancy 'From' date must be before 'To' date" },
        { status: 400 }
      );
    }
  }

  // Validate moveInDate is not in the future
  if (data.moveInDate && new Date(data.moveInDate) > new Date()) {
    return NextResponse.json(
      { error: "Move-in date cannot be in the future" },
      { status: 400 }
    );
  }

  const updateData: any = {};
  if (data.tenantName !== undefined) updateData.tenantName = data.tenantName;
  if (data.tenantPhone !== undefined) updateData.tenantPhone = data.tenantPhone;
  if (data.tenantEmail !== undefined) updateData.tenantEmail = data.tenantEmail || null;
  if (data.moveInDate !== undefined)
    updateData.moveInDate = data.moveInDate ? new Date(data.moveInDate) : null;
  if (data.tenancyFrom !== undefined)
    updateData.tenancyFrom = data.tenancyFrom ? new Date(data.tenancyFrom) : null;
  if (data.tenancyTo !== undefined)
    updateData.tenancyTo = data.tenancyTo ? new Date(data.tenancyTo) : null;
  if (data.permanentAddress !== undefined)
    updateData.permanentAddress = data.permanentAddress || null;
  if (data.fatherSpouseName !== undefined)
    updateData.fatherSpouseName = data.fatherSpouseName || null;
  if (data.dateOfBirth !== undefined)
    updateData.dateOfBirth = data.dateOfBirth ? new Date(data.dateOfBirth) : null;
  if (data.occupation !== undefined) updateData.occupation = data.occupation || null;
  if (data.employer !== undefined) updateData.employer = data.employer || null;
  if (data.officeAddress !== undefined) updateData.officeAddress = data.officeAddress || null;
  if (data.nationality !== undefined) updateData.nationality = data.nationality || null;
  if (data.maritalStatus !== undefined) updateData.maritalStatus = data.maritalStatus || null;
  if (data.idProofType !== undefined) updateData.idProofType = data.idProofType || null;
  if (data.idProofLast4 !== undefined)
    updateData.tenantIdProof = data.idProofLast4 || null;
  if (data.policeStatus !== undefined) updateData.policeStatus = data.policeStatus || null;
  if (data.policeRefNumber !== undefined)
    updateData.policeVerificationRef = data.policeRefNumber || null;
  if (data.policeRefDate !== undefined)
    updateData.policeVerifiedAt = data.policeRefDate ? new Date(data.policeRefDate) : null;
  if (data.previousAddress !== undefined)
    updateData.previousAddress = data.previousAddress || null;
  if (data.emergencyContactName !== undefined)
    updateData.emergencyContactName = data.emergencyContactName || null;
  if (data.emergencyContactRelation !== undefined)
    updateData.emergencyContactRelation = data.emergencyContactRelation || null;
  if (data.emergencyContactMobile !== undefined)
    updateData.emergencyContactMobile = data.emergencyContactMobile || null;
  if (connectionId !== undefined) updateData.connectionId = connectionId;
  if (tower !== undefined) updateData.tower = tower;
  if (flatNo !== undefined) updateData.flatNo = flatNo;
  if (residentId !== undefined) updateData.residentId = residentId;

  const updated = await prisma.$transaction(async (tx) => {
    const app = await tx.tenantApplication.update({
      where: { id },
      data: updateData,
    });

    await tx.auditLog.create({
      data: {
        userId,
        action: "UPDATE",
        entity: "TenantApplication",
        entityId: id,
        meta: {
          applicationNumber: app.applicationNumber,
          changedFields: Object.keys(updateData),
        },
      },
    });

    return app;
  });

  return NextResponse.json({ application: updated });
}

export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { guardTenantVerificationEnabled, getEnforcedChannels } from "@/lib/tenant-verification-config";
import { hasVerifiedOtp } from "@/lib/tenant-verification-otp";
import { nextTenantApplicationNumber } from "@/lib/tenant-verification";
import { z } from "zod";

const createDraftSchema = z.object({
  flatId: z.string().min(1, "Select a flat"),
  tenantName: z.string().min(1, "Full name is required"),
  tenantPhone: z.string().min(10, "Phone is required"),
  tenantEmail: z.string().email().optional().or(z.literal("")),
  moveInDate: z.string().datetime().optional().nullable(),
  tenancyFrom: z.string().datetime().optional().nullable(),
  tenancyTo: z.string().datetime().optional().nullable(),
  permanentAddress: z.string().optional().or(z.literal("")),
  fatherSpouseName: z.string().optional().or(z.literal("")),
  dateOfBirth: z.string().datetime().optional().nullable(),
  occupation: z.string().optional().or(z.literal("")),
  employer: z.string().optional().or(z.literal("")),
  officeAddress: z.string().optional().or(z.literal("")),
  nationality: z.string().optional().or(z.literal("")),
  maritalStatus: z.string().optional().or(z.literal("")),
  idProofType: z.string().optional().or(z.literal("")),
  idProofLast4: z.string().optional().or(z.literal("")),
  policeStatus: z.string().optional().or(z.literal("")),
  policeRefNumber: z.string().optional().or(z.literal("")),
  policeRefDate: z.string().datetime().optional().nullable(),
  previousAddress: z.string().optional().or(z.literal("")),
  emergencyContactName: z.string().optional().or(z.literal("")),
  emergencyContactRelation: z.string().optional().or(z.literal("")),
  emergencyContactMobile: z.string().optional().or(z.literal("")),
  consentAccepted: z.boolean().optional(),
  familyMembers: z
    .array(
      z.object({
        fullName: z.string().min(1, "Name is required"),
        relation: z.string().min(1, "Relationship is required"),
        // z.coerce turns "" into 0 — treat "no age" as null.
        age: z.preprocess(
          (value) => (value === "" || value === undefined ? null : value),
          z.coerce.number().optional().nullable()
        ),
        idProof: z.string().optional().or(z.literal("")),
      })
    )
    .optional(),
  vehicles: z
    .array(
      z.object({
        vehicleType: z.string().optional().or(z.literal("")),
        registrationNo: z.string().optional().or(z.literal("")),
        stickerRfidNo: z.string().optional().or(z.literal("")),
      })
    )
    .optional(),
});

const applicationInclude = {
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
} as const;

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const disabled = await guardTenantVerificationEnabled();
  if (disabled) return disabled;

  const userId = String((session.user as any).id ?? "");
  const userEmail = (session.user as any).email as string | undefined;
  const url = new URL(req.url);
  const phoneParam = url.searchParams.get("phone");
  const statusParam = url.searchParams.get("status");

  // Build where clause: match by user link or phone
  const where: any = {};

  if (phoneParam) {
    where.tenantPhone = phoneParam;
  } else if (userEmail) {
    where.OR = [
      { residentId: userId },
      { tenantEmail: userEmail },
    ];
  } else {
    where.residentId = userId;
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
    console.error("Tenant applications GET error:", error?.message ?? error);
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

  const parsed = createDraftSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const data = parsed.data;
  const userId = String((session.user as any).id ?? "");

  // Contact verification is enforced for whichever channels the admin enabled.
  const channels = await getEnforcedChannels();

  if (channels.phone) {
    const phoneVerified = await hasVerifiedOtp({ channel: "PHONE", phone: data.tenantPhone });
    if (!phoneVerified) {
      return NextResponse.json(
        { error: "Phone not verified. Please complete OTP verification first." },
        { status: 403 }
      );
    }
  }

  if (channels.email) {
    if (!data.tenantEmail) {
      return NextResponse.json(
        { error: "Email address is required for email verification." },
        { status: 400 }
      );
    }
    const emailVerified = await hasVerifiedOtp({ channel: "EMAIL", email: data.tenantEmail });
    if (!emailVerified) {
      return NextResponse.json(
        { error: "Email not verified. Please complete OTP verification first." },
        { status: 403 }
      );
    }
  }

  // Verify the flat exists
  const connection = await prisma.connection.findUnique({
    where: { id: data.flatId },
    select: { id: true, flatNo: true, tower: true, residentId: true },
  });

  if (!connection) {
    return NextResponse.json({ error: "Flat not found" }, { status: 404 });
  }

  // Validate date order: tenancyFrom <= tenancyTo
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

  const applicationNumber = await nextTenantApplicationNumber();
  const applicationToken = crypto.randomUUID();

  const application = await prisma.$transaction(async (tx) => {
    const created = await tx.tenantApplication.create({
      data: {
        applicationNumber,
        applicationToken,
        residentId: connection.residentId,
        connectionId: data.flatId,
        tenantName: data.tenantName,
        tenantPhone: data.tenantPhone,
        tenantEmail: data.tenantEmail || null,
        tenantIdProof: data.idProofLast4 || null,
        moveInDate: data.moveInDate ? new Date(data.moveInDate) : null,
        moveOutDate: null,
        tenancyFrom: data.tenancyFrom ? new Date(data.tenancyFrom) : null,
        tenancyTo: data.tenancyTo ? new Date(data.tenancyTo) : null,
        permanentAddress: data.permanentAddress || null,
        fatherSpouseName: data.fatherSpouseName || null,
        dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
        occupation: data.occupation || null,
        employer: data.employer || null,
        officeAddress: data.officeAddress || null,
        nationality: data.nationality || null,
        maritalStatus: data.maritalStatus || null,
        previousAddress: data.previousAddress || null,
        emergencyContactName: data.emergencyContactName || null,
        emergencyContactRelation: data.emergencyContactRelation || null,
        emergencyContactMobile: data.emergencyContactMobile || null,
        consentAccepted: data.consentAccepted ?? false,
        consentAcceptedAt: data.consentAccepted ? new Date() : null,
        status: "PENDING",
        tower: connection.tower,
        flatNo: connection.flatNo,
        policeStatus: data.policeStatus || null,
        policeVerificationRef: data.policeRefNumber || null,
        policeVerifiedAt: data.policeRefDate ? new Date(data.policeRefDate) : null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      include: applicationInclude as any,
    });

    if (data.familyMembers?.length) {
      await tx.tenantFamilyMember.createMany({
        data: data.familyMembers.map((member) => ({
          applicationId: created.id,
          fullName: member.fullName,
          relation: member.relation,
          // A 0 can only mean the field was left empty — coerce turns "" into 0.
          age: member.age === 0 ? null : member.age ?? null,
          idProof: member.idProof || null,
        })),
      });
    }

    if (data.vehicles?.length) {
      await tx.tenantVehicle.createMany({
        data: data.vehicles.map((vehicle) => ({
          applicationId: created.id,
          vehicleType: vehicle.vehicleType || null,
          registrationNo: vehicle.registrationNo || null,
          stickerRfidNo: vehicle.stickerRfidNo || null,
        })),
      });
    }

    await tx.auditLog.create({
      data: {
        userId,
        action: "CREATE",
        entity: "TenantApplication",
        entityId: created.id,
        meta: {
          applicationNumber,
          flatId: data.flatId,
          tenantName: data.tenantName,
        },
      },
    });

    return created;
  });

  return NextResponse.json({ application }, { status: 201 });
}

export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { guardTenantVerificationEnabled, getEnforcedChannels } from "@/lib/tenant-verification-config";
import { hasVerifiedOtp } from "@/lib/tenant-verification-otp";
import { z } from "zod";

const submitSchema = z.object({
  consentAccepted: z.boolean().refine((v) => v === true, {
    message: "You must accept the declaration to submit",
  }),
  consentVersion: z.string().min(1, "Consent version is required"),
});

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
  const userEmail = (session.user as any).email as string | undefined;
  const url = new URL(req.url);
  const phoneParam = url.searchParams.get("phone");

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = submitSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { consentAccepted, consentVersion } = parsed.data;

  // Check ownership and current status
  const existing = await prisma.tenantApplication.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      residentId: true,
      tenantEmail: true,
      tenantPhone: true,
      applicationNumber: true,
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

  // Only DRAFT applications can be submitted
  if (existing.status !== "PENDING") {
    return NextResponse.json(
      { error: "Only draft applications can be submitted" },
      { status: 409 }
    );
  }

  // Contact verification is enforced for whichever channels the admin enabled.
  const channels = await getEnforcedChannels();

  if (channels.phone) {
    const phoneVerified = await hasVerifiedOtp({
      channel: "PHONE",
      phone: existing.tenantPhone,
    });
    if (!phoneVerified) {
      return NextResponse.json(
        { error: "Phone not verified. Please complete OTP verification first." },
        { status: 403 }
      );
    }
  }

  if (channels.email) {
    if (!existing.tenantEmail) {
      return NextResponse.json(
        { error: "Email address is required for email verification." },
        { status: 400 }
      );
    }
    const emailVerified = await hasVerifiedOtp({
      channel: "EMAIL",
      email: existing.tenantEmail,
    });
    if (!emailVerified) {
      return NextResponse.json(
        { error: "Email not verified. Please complete OTP verification first." },
        { status: 403 }
      );
    }
  }

  // Validate completeness: check required fields are filled
  const fullApp = await prisma.tenantApplication.findUnique({
    where: { id },
    include: {
      documents: true,
      family: true,
      vehicles: true,
    },
  });

  if (!fullApp) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }

  const missingFields: string[] = [];
  if (!fullApp.tenantName) missingFields.push("Tenant name");
  if (!fullApp.tenantPhone) missingFields.push("Phone number");
  if (!fullApp.connectionId) missingFields.push("Flat selection");
  if (!fullApp.moveInDate) missingFields.push("Move-in date");
  if (!fullApp.emergencyContactName) missingFields.push("Emergency contact name");
  if (!fullApp.emergencyContactMobile) missingFields.push("Emergency contact phone");
  if (!fullApp.tenantIdProof) missingFields.push("ID proof number");
  if (fullApp.documents.length === 0) missingFields.push("At least one document");

  if (missingFields.length > 0) {
    return NextResponse.json(
      {
        error: "Application incomplete",
        missingFields,
      },
      { status: 400 }
    );
  }

  const submitted = await prisma.$transaction(async (tx) => {
    const updated = await tx.tenantApplication.update({
      where: { id },
      data: {
        status: "DOCUMENTS_SUBMITTED",
        consentAccepted: true,
        consentVersion,
        consentAcceptedAt: new Date(),
      },
    });

    await tx.auditLog.create({
      data: {
        userId,
        action: "SUBMIT",
        entity: "TenantApplication",
        entityId: id,
        meta: {
          applicationNumber: updated.applicationNumber,
          consentVersion,
        },
      },
    });

    return updated;
  });

  return NextResponse.json({
    application: submitted,
    message: "Application submitted successfully",
  });
}

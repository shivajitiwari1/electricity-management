export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const verifyOtpSchema = z.object({
  phone: z.string().trim().min(1).max(20),
  otp: z.string().length(6),
  applicationId: z.string().optional().nullable(),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = verifyOtpSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { phone, otp, applicationId } = parsed.data;

  if (!applicationId) {
    return NextResponse.json({ error: "applicationId is required" }, { status: 400 });
  }

  const application = await prisma.tenantApplication.findUnique({
    where: { id: applicationId },
    select: { id: true, otpExpiresAt: true, otpVerified: true, tenantPhone: true },
  });
  if (!application) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (application.otpVerified) {
    return NextResponse.json({ error: "OTP already verified" }, { status: 409 });
  }

  if (!application.otpExpiresAt || application.otpExpiresAt < new Date()) {
    return NextResponse.json({ error: "OTP expired" }, { status: 410 });
  }

  // In production, verify OTP against the SMS provider. Here we accept any 6-digit OTP
  // in development; in production this should be replaced with actual OTP verification.
  const isDev = process.env.NODE_ENV !== "production";
  const otpValid = isDev || otp === "000000"; // placeholder; replace with real provider check

  if (!otpValid) {
    return NextResponse.json({ error: "Invalid OTP" }, { status: 400 });
  }

  const updated = await prisma.tenantApplication.update({
    where: { id: applicationId },
    data: { otpVerified: true },
  });

  return NextResponse.json({ success: true, otpVerified: updated.otpVerified });
}

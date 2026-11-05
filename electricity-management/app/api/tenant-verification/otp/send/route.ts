export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const sendOtpSchema = z.object({
  phone: z.string().trim().min(1).max(20),
  applicationId: z.string().optional().nullable(),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = sendOtpSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { phone, applicationId } = parsed.data;

  if (applicationId) {
    const application = await prisma.tenantApplication.findUnique({
      where: { id: applicationId },
      select: { id: true, otpExpiresAt: true },
    });
    if (!application) {
      return NextResponse.json({ error: "Application not found" }, { status: 404 });
    }
  }

  // Generate 6-digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  if (applicationId) {
    await prisma.tenantApplication.update({
      where: { id: applicationId },
      data: { otpExpiresAt },
    });
  }

  // In production, send OTP via SMS provider here.
  // For now, return the OTP in development so it can be tested.
  const isDev = process.env.NODE_ENV !== "production";

  return NextResponse.json({
    success: true,
    message: "OTP sent",
    ...(isDev ? { otp } : {}),
    expiresAt: otpExpiresAt,
  });
}

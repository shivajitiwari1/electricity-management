export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyOtpSession, markPhoneVerified } from "@/lib/tenant-verification-otp";

const verifyOtpSchema = z.object({
  phone: z.string().min(10, "Please enter a valid phone number"),
  otp: z.string().length(6, "OTP must be 6 digits"),
  purpose: z.enum(["APPLICATION_REGISTRATION", "APPLICATION_LOGIN"]).default("APPLICATION_REGISTRATION"),
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

  const { phone, otp, purpose } = parsed.data;

  try {
    const result = await verifyOtpSession({ phone, otp, purpose });

    // Mark phone as verified in the system
    await markPhoneVerified({
      phone: result.phone,
      purpose,
      sessionId: result.sessionId,
    });

    return NextResponse.json({
      success: true,
      message: "OTP verified successfully",
      phoneVerified: true,
      phone: result.phone,
    });
  } catch (error: any) {
    // Generic error message to prevent enumeration
    return NextResponse.json(
      { error: error.message || "Invalid OTP. Please try again." },
      { status: 400 }
    );
  }
}

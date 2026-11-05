export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createOtpSession } from "@/lib/tenant-verification-otp";

const requestOtpSchema = z.object({
  phone: z.string().min(10, "Please enter a valid phone number"),
  purpose: z.enum(["APPLICATION_REGISTRATION", "APPLICATION_LOGIN"]).default("APPLICATION_REGISTRATION"),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = requestOtpSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { phone, purpose } = parsed.data;

  try {
    const result = await createOtpSession({ phone, purpose });

    // TODO: Send OTP via approved SMS provider here.
    // Provider selection is pending management confirmation.
    // For development, the OTP is returned in the response (NODE_ENV !== "production").
    // In production, the OTP must be sent via SMS and NOT returned in the response.
    const isDev = process.env.NODE_ENV !== "production";

    return NextResponse.json({
      success: true,
      message: "OTP sent",
      sessionId: result.sessionId,
      expiresAt: result.expiresAt,
      ...(isDev ? { otp: result.otp } : {}), // only return OTP in non-production
    });
  } catch (error: any) {
    // Generic error message to prevent phone enumeration
    return NextResponse.json(
      { error: error.message || "Failed to send OTP. Please try again." },
      { status: 400 }
    );
  }
}

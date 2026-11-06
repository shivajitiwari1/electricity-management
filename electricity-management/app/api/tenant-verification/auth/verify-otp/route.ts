export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyOtpSession, markIdentifierVerified } from "@/lib/tenant-verification-otp";
import { getVerificationSettings } from "@/lib/tenant-verification-config";

const verifyOtpSchema = z
  .object({
    channel: z.enum(["PHONE", "EMAIL"]).default("PHONE"),
    phone: z.string().min(10, "Please enter a valid phone number").optional(),
    email: z.string().email("Please enter a valid email address").optional(),
    otp: z.string().length(6, "OTP must be 6 digits"),
    purpose: z
      .enum(["APPLICATION_REGISTRATION", "APPLICATION_LOGIN"])
      .default("APPLICATION_REGISTRATION"),
  })
  .refine(
    (value) =>
      value.channel === "EMAIL" ? Boolean(value.email) : Boolean(value.phone && value.phone.length >= 10),
    { message: "A phone number or email address is required for the selected channel." }
  );

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

  const { channel, phone, email, otp, purpose } = parsed.data;

  const settings = await getVerificationSettings();
  const enabled = channel === "EMAIL" ? settings.channels.email : settings.channels.phone;
  if (!enabled) {
    return NextResponse.json(
      {
        error:
          channel === "EMAIL"
            ? "Email verification is not enabled for tenant applications."
            : "Phone verification is not enabled for tenant applications.",
      },
      { status: 400 }
    );
  }

  try {
    const result = await verifyOtpSession(
      channel === "EMAIL"
        ? { channel: "EMAIL", email: email!, otp, purpose }
        : { channel: "PHONE", phone: phone!, otp, purpose }
    );

    await markIdentifierVerified(
      result.channel === "EMAIL"
        ? { channel: "EMAIL", email: result.identifier, purpose, sessionId: result.sessionId }
        : { channel: "PHONE", phone: result.identifier, purpose, sessionId: result.sessionId }
    );

    return NextResponse.json({
      success: true,
      message: "OTP verified successfully",
      channel: result.channel,
      identifier: result.identifier,
      phoneVerified: result.channel === "PHONE",
      emailVerified: result.channel === "EMAIL",
      phone: result.phone,
      email: result.email,
    });
  } catch (error: any) {
    // Generic error message to prevent enumeration
    return NextResponse.json(
      { error: error.message || "Invalid OTP. Please try again." },
      { status: 400 }
    );
  }
}

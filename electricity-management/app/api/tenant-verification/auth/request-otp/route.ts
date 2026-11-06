export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  createOtpSession,
  deleteOtpSession,
  OTP_EXPIRY_MINUTES,
} from "@/lib/tenant-verification-otp";
import {
  emailDeliveryConfigured,
  getVerificationSettings,
} from "@/lib/tenant-verification-config";
import { sendOtpSms, SmsError } from "@/lib/sms";
import { sendOtpEmail } from "@/lib/tenant-verification-email";

const requestOtpSchema = z
  .object({
    channel: z.enum(["PHONE", "EMAIL"]).default("PHONE"),
    phone: z.string().min(10, "Please enter a valid phone number").optional(),
    email: z.string().email("Please enter a valid email address").optional(),
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

  const parsed = requestOtpSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { channel, phone, email, purpose } = parsed.data;

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

  const isDev = process.env.NODE_ENV !== "production";

  try {
    const result = await createOtpSession(
      channel === "EMAIL"
        ? { channel: "EMAIL", email: email!, purpose }
        : { channel: "PHONE", phone: phone!, purpose }
    );

    let deliverySkipped = false;

    try {
      if (channel === "EMAIL") {
        if (emailDeliveryConfigured()) {
          await sendOtpEmail({
            to: email!,
            otp: result.otp,
            ttlMinutes: OTP_EXPIRY_MINUTES,
          });
        } else {
          deliverySkipped = true;
        }
      } else if (settings.fast2smsApiKey) {
        await sendOtpSms({
          phone: phone!,
          otp: result.otp,
          apiKey: settings.fast2smsApiKey,
        });
      } else {
        deliverySkipped = true;
      }
    } catch (deliveryError: any) {
      // Never leave a usable session behind when the message did not go out.
      await deleteOtpSession(result.sessionId);
      if (channel === "EMAIL") {
        // Do not leak raw SMTP error details to the client.
        throw new Error("Could not send the verification email. Check the email server settings.");
      }
      throw deliveryError;
    }

    return NextResponse.json({
      success: true,
      message:
        channel === "EMAIL" ? "OTP sent to your email address" : "OTP sent to your mobile number",
      channel,
      sessionId: result.sessionId,
      expiresAt: result.expiresAt,
      // Only surface the OTP on screen when nothing was actually delivered
      // (development/testing without a provider). This never happens in
      // production, where providers are required.
      ...(isDev && deliverySkipped ? { otp: result.otp, deliverySkipped } : {}),
    });
  } catch (error: any) {
    if (error instanceof SmsError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: error.message || "Failed to send OTP. Please try again." },
      { status: 400 }
    );
  }
}

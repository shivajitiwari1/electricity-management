export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { z } from "zod";
import { getVerificationSettings } from "@/lib/tenant-verification-config";
import { generateOtp } from "@/lib/tenant-verification-otp";
import { sendOtpSms, SmsError } from "@/lib/sms";

const schema = z.object({
  phone: z.string().min(10, "Enter a valid mobile number"),
});

/** Sends one test SMS with the saved Fast2SMS key. Creates no OTP session. */
export async function POST(req: NextRequest) {
  const session = await auth();
  const role = (session?.user as any)?.role as string | undefined;
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (role !== "ADMIN") {
    return NextResponse.json({ error: "Only an admin can send a test SMS" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const settings = await getVerificationSettings();
  if (!settings.fast2smsApiKey) {
    return NextResponse.json(
      { error: "Save a Fast2SMS API key first." },
      { status: 400 }
    );
  }

  try {
    const result = await sendOtpSms({
      phone: parsed.data.phone,
      otp: generateOtp(),
      apiKey: settings.fast2smsApiKey,
    });
    return NextResponse.json({
      success: true,
      message: `Test SMS sent to ${result.numbers}.`,
      requestId: result.requestId,
    });
  } catch (error: any) {
    if (error instanceof SmsError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: error?.message || "Could not send the test SMS." },
      { status: 502 }
    );
  }
}

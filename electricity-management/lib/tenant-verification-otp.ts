import { prisma } from "@/lib/prisma";
import bcryptjs from "bcryptjs";

export const OTP_LENGTH = 6;
export const OTP_EXPIRY_MINUTES = 10;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_RESEND_COOLDOWN_SECONDS = 60;
export const OTP_RATE_LIMIT_WINDOW_HOURS = 1;
export const OTP_RATE_LIMIT_MAX = 3;

/**
 * Generates a 6-digit numeric OTP.
 */
export function generateOtp(): string {
  let otp = "";
  for (let i = 0; i < OTP_LENGTH; i++) {
    otp += Math.floor(Math.random() * 10).toString();
  }
  return otp;
}

/**
 * Hashes an OTP using bcrypt. Never stores plaintext OTP.
 */
export async function hashOtp(otp: string): Promise<string> {
  return bcryptjs.hash(otp, 10);
}

/**
 * Verifies an OTP against its bcrypt hash.
 */
export async function verifyOtpHash(otp: string, hash: string): Promise<boolean> {
  return bcryptjs.compare(otp, hash);
}

/**
 * Creates or updates an OTP session for a phone number.
 * Returns the plaintext OTP (only for sending via SMS provider).
 * Caller must send the OTP via their approved SMS provider.
 */
export async function createOtpSession({
  phone,
  purpose = "APPLICATION_REGISTRATION",
}: {
  phone: string;
  purpose?: "APPLICATION_REGISTRATION" | "APPLICATION_LOGIN";
}) {
  // Normalize phone: remove spaces, dashes, parentheses
  const normalizedPhone = phone.replace(/[\s\-()]/g, "");

  // Rate limit: count OTP requests in the last hour for this phone
  const oneHourAgo = new Date(Date.now() - OTP_RATE_LIMIT_WINDOW_HOURS * 60 * 60 * 1000);
  const recentRequests = await prisma.otpSession.count({
    where: {
      phone: normalizedPhone,
      createdAt: { gte: oneHourAgo },
    },
  });

  if (recentRequests >= OTP_RATE_LIMIT_MAX) {
    throw new Error("Too many OTP requests. Please try again later.");
  }

  // Resend cooldown: check if there's a recent unverified session
  const existing = await prisma.otpSession.findFirst({
    where: {
      phone: normalizedPhone,
      purpose,
      verified: false,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });

  if (existing) {
    const secondsSinceCreated = Math.floor(
      (Date.now() - existing.createdAt.getTime()) / 1000
    );
    if (secondsSinceCreated < OTP_RESEND_COOLDOWN_SECONDS) {
      const waitSeconds = OTP_RESEND_COOLDOWN_SECONDS - secondsSinceCreated;
      throw new Error(`Please wait ${waitSeconds} seconds before requesting another OTP.`);
    }
  }

  // Generate OTP and hash it
  const otp = generateOtp();
  const otpHash = await hashOtp(otp);
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  // Invalidate any existing unverified sessions for this phone + purpose
  await prisma.otpSession.updateMany({
    where: {
      phone: normalizedPhone,
      purpose,
      verified: false,
    },
    data: { verified: true }, // mark as consumed so they can't be used
  });

  // Create new OTP session
  const session = await prisma.otpSession.create({
    data: {
      phone: normalizedPhone,
      purpose,
      otpHash,
      attempts: 0,
      maxAttempts: OTP_MAX_ATTEMPTS,
      expiresAt,
      verified: false,
    },
  });

  return {
    sessionId: session.id,
    otp, // plaintext OTP — send via SMS provider, do not log
    expiresAt,
  };
}

/**
 * Verifies an OTP for a phone number.
 * Returns { success, phone } on success, or throws on failure.
 */
export async function verifyOtpSession({
  phone,
  otp,
  purpose = "APPLICATION_REGISTRATION",
}: {
  phone: string;
  otp: string;
  purpose?: "APPLICATION_REGISTRATION" | "APPLICATION_LOGIN";
}) {
  const normalizedPhone = phone.replace(/[\s\-()]/g, "");

  const session = await prisma.otpSession.findFirst({
    where: {
      phone: normalizedPhone,
      purpose,
      verified: false,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!session) {
    throw new Error("Invalid or expired OTP. Please request a new one.");
  }

  // Check attempt limit
  if (session.attempts >= session.maxAttempts) {
    throw new Error("Too many failed OTP attempts. Please request a new OTP.");
  }

  // Increment attempt count
  await prisma.otpSession.update({
    where: { id: session.id },
    data: { attempts: session.attempts + 1 },
  });

  // Verify OTP hash
  const isValid = await verifyOtpHash(otp, session.otpHash);
  if (!isValid) {
    throw new Error("Invalid OTP. Please try again.");
  }

  // Mark session as verified
  await prisma.otpSession.update({
    where: { id: session.id },
    data: { verified: true },
  });

  return {
    success: true,
    phone: normalizedPhone,
    sessionId: session.id,
  };
}

/**
 * Marks a phone number as OTP-verified in the system.
 * Creates or links a user identity for the verified phone.
 */
export async function markPhoneVerified({
  phone,
  purpose,
  sessionId,
}: {
  phone: string;
  purpose: string;
  sessionId: string;
}) {
  const normalizedPhone = phone.replace(/[\s\-()]/g, "");

  // Verify the session exists and is verified
  const session = await prisma.otpSession.findUnique({
    where: { id: sessionId },
  });

  if (!session || !session.verified || session.phone !== normalizedPhone) {
    throw new Error("Invalid or unverified OTP session.");
  }

  // Mark all sessions for this phone as verified (consumed)
  await prisma.otpSession.updateMany({
    where: { phone: normalizedPhone },
    data: { verified: true },
  });

  return {
    success: true,
    phone: normalizedPhone,
    phoneVerified: true,
  };
}

/**
 * Cleanup expired OTP sessions (call via cron).
 */
export async function cleanupExpiredOtps() {
  await prisma.otpSession.deleteMany({
    where: {
      expiresAt: { lt: new Date() },
    },
  });
}

import { prisma } from "@/lib/prisma";
import bcryptjs from "bcryptjs";

export const OTP_LENGTH = 6;
export const OTP_EXPIRY_MINUTES = 10;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_RESEND_COOLDOWN_SECONDS = 60;
export const OTP_RATE_LIMIT_WINDOW_HOURS = 1;
export const OTP_RATE_LIMIT_MAX = 3;
/** How long a verified OTP still counts as proof of ownership. */
export const OTP_VERIFIED_WINDOW_MINUTES = 30;

export type OtpChannel = "PHONE" | "EMAIL";

export type OtpPurposeValue = "APPLICATION_REGISTRATION" | "APPLICATION_LOGIN";

/**
 * A phone number or an email address to send an OTP to.
 * `{ phone }` keeps working without passing `channel`.
 */
export type OtpTarget = { phone: string; channel?: "PHONE" } | { email: string; channel: "EMAIL" };

type ResolvedTarget = {
  channel: OtpChannel;
  identifier: string;
  field: "phone" | "email";
};

function normalizePhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) return digits.slice(1);
  return digits;
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function resolveTarget(target: OtpTarget): ResolvedTarget {
  if (target.channel === "EMAIL") {
    return { channel: "EMAIL", identifier: normalizeEmail(target.email), field: "email" };
  }
  return { channel: "PHONE", identifier: normalizePhone(target.phone), field: "phone" };
}

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
 * Creates or updates an OTP session for a phone number or email address.
 * Returns the plaintext OTP (only for handing to a delivery provider).
 */
export async function createOtpSession({
  purpose = "APPLICATION_REGISTRATION",
  ...target
}: OtpTarget & {
  purpose?: "APPLICATION_REGISTRATION" | "APPLICATION_LOGIN";
}) {
  const resolved = resolveTarget(target as OtpTarget);
  const { channel, identifier, field } = resolved;

  // Rate limit: count OTP requests in the last hour for this identifier
  const oneHourAgo = new Date(Date.now() - OTP_RATE_LIMIT_WINDOW_HOURS * 60 * 60 * 1000);
  const recentRequests = await prisma.otpSession.count({
    where: {
      [field]: identifier,
      createdAt: { gte: oneHourAgo },
    },
  });

  if (recentRequests >= OTP_RATE_LIMIT_MAX) {
    throw new Error("Too many OTP requests. Please try again later.");
  }

  // Resend cooldown: check if there's a recent unverified session
  const existing = await prisma.otpSession.findFirst({
    where: {
      [field]: identifier,
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

  // Drop any previous unverified sessions for this identifier. They are deleted
  // rather than flagged verified, because a verified row is proof of ownership
  // and an abandoned request must never become proof.
  await prisma.otpSession.deleteMany({
    where: {
      [field]: identifier,
      purpose,
      verified: false,
    },
  });

  // Create new OTP session
  const session = await prisma.otpSession.create({
    data: {
      channel,
      phone: field === "phone" ? identifier : null,
      email: field === "email" ? identifier : null,
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
    otp, // plaintext OTP — hand to the delivery provider, do not log
    channel,
    identifier,
    expiresAt,
  };
}

/**
 * Verifies an OTP for a phone number or email address.
 * Returns { success, channel, identifier } on success, or throws on failure.
 */
export async function verifyOtpSession({
  otp,
  purpose = "APPLICATION_REGISTRATION",
  ...target
}: OtpTarget & {
  otp: string;
  purpose?: "APPLICATION_REGISTRATION" | "APPLICATION_LOGIN";
}) {
  const { channel, identifier, field } = resolveTarget(target as OtpTarget);

  const session = await prisma.otpSession.findFirst({
    where: {
      [field]: identifier,
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

  // Mark session as verified. Extending expiresAt gives the applicant a working
  // window to finish the form after verifying.
  await prisma.otpSession.update({
    where: { id: session.id },
    data: {
      verified: true,
      expiresAt: new Date(Date.now() + OTP_VERIFIED_WINDOW_MINUTES * 60 * 1000),
    },
  });

  return {
    success: true,
    channel,
    identifier,
    phone: channel === "PHONE" ? identifier : null,
    email: channel === "EMAIL" ? identifier : null,
    sessionId: session.id,
  };
}

/** Removes a session that was never delivered (provider failure, bad number). */
export async function deleteOtpSession(sessionId: string) {
  await prisma.otpSession.deleteMany({ where: { id: sessionId } });
}

/**
 * Confirms an OTP session is verified and still within its validity window.
 * Used as the gate before an application may be created or submitted.
 */
export async function hasVerifiedOtp(target: OtpTarget) {
  const { identifier, field } = resolveTarget(target);

  const session = await prisma.otpSession.findFirst({
    where: {
      [field]: identifier,
      verified: true,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });

  return Boolean(session);
}

/**
 * Marks an identifier as OTP-verified in the system.
 * Old unverified sessions are removed so an abandoned request can never be
 * mistaken for proof of ownership.
 */
export async function markIdentifierVerified({
  purpose,
  sessionId,
  ...target
}: OtpTarget & {
  purpose: OtpPurposeValue;
  sessionId: string;
}) {
  const { channel, identifier, field } = resolveTarget(target as OtpTarget);

  // Verify the session exists and is verified
  const session = await prisma.otpSession.findUnique({
    where: { id: sessionId },
  });

  if (!session || !session.verified || session[field] !== identifier) {
    throw new Error("Invalid or unverified OTP session.");
  }

  await prisma.otpSession.deleteMany({
    where: {
      [field]: identifier,
      purpose,
      verified: false,
    },
  });

  return {
    success: true,
    channel,
    identifier,
    phoneVerified: channel === "PHONE",
    emailVerified: channel === "EMAIL",
  };
}

/**
 * Backwards-compatible wrapper for the phone-only callers.
 */
export async function markPhoneVerified(args: { phone: string; purpose: OtpPurposeValue; sessionId: string }) {
  return markIdentifierVerified({ ...args, channel: "PHONE" });
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

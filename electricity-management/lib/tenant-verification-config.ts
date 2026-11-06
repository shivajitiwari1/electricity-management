import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function tenantVerificationEnabled() {
  try {
    const config = await prisma.siteConfig.findUnique({
      where: { id: "singleton" },
      select: { tenantVerificationEnabled: true },
    });
    return config?.tenantVerificationEnabled ?? false;
  } catch (error: any) {
    if (error?.code === "P2021" || error?.code === "P2022") {
      // SiteConfig column not created yet (migration pending) — module off
      return false;
    }
    throw error;
  }
}

/** Returns a 503 NextResponse when the Tenant Verification module is disabled, or null. */
export async function guardTenantVerificationEnabled() {
  const enabled = await tenantVerificationEnabled();
  if (enabled) return null;
  return NextResponse.json(
    { error: "Tenant Verification is disabled. Enable it from the admin page first." },
    { status: 503 }
  );
}

export const TENANT_VERIFICATION_PAGE_ID = "tenant-verification";

// ---------------------------------------------------------------------------
// Verification channel settings (email / phone / both)
// ---------------------------------------------------------------------------

export type VerificationMethod = "EMAIL" | "PHONE" | "BOTH";

export const VERIFICATION_METHODS: VerificationMethod[] = ["EMAIL", "PHONE", "BOTH"];

export const DEFAULT_VERIFICATION_METHOD: VerificationMethod = "PHONE";

export function parseVerificationMethod(value: unknown): VerificationMethod {
  return value === "EMAIL" || value === "PHONE" || value === "BOTH"
    ? value
    : DEFAULT_VERIFICATION_METHOD;
}

function isProduction() {
  return process.env.NODE_ENV === "production";
}

/** True when SMTP is configured well enough to actually deliver an email. */
export function emailDeliveryConfigured() {
  if (process.env.DISABLE_EMAILS === "true") return false;
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  return Boolean(host && user && pass);
}

function isMigrationPending(error: any) {
  return error?.code === "P2021" || error?.code === "P2022";
}

export type VerificationSettings = {
  /** What the admin selected. */
  method: VerificationMethod;
  /** Fast2SMS key from the database, falling back to the FAST2SMS_API_KEY env var. */
  fast2smsApiKey: string | null;
  /** Whether each delivery channel can actually send a message right now. */
  smsReady: boolean;
  emailReady: boolean;
  /** Whether a real provider is configured (false in dev-only mode). */
  smsConfigured: boolean;
  emailConfigured: boolean;
  /**
   * Channels that are both selected by the admin *and* able to deliver.
   * These are the ones shown to the tenant and enforced on submit.
   * Outside production a channel is always considered ready so the OTP can be
   * displayed on screen for testing.
   */
  channels: { email: boolean; phone: boolean };
};

export async function getVerificationSettings(): Promise<VerificationSettings> {
  let method: VerificationMethod = DEFAULT_VERIFICATION_METHOD;
  let storedKey: string | null = null;

  try {
    const config = await prisma.siteConfig.findUnique({
      where: { id: "singleton" },
      select: { tenantVerificationMethod: true, fast2smsApiKey: true },
    });
    method = parseVerificationMethod(config?.tenantVerificationMethod);
    storedKey = config?.fast2smsApiKey ?? null;
  } catch (error: any) {
    if (!isMigrationPending(error)) throw error;
    // Column not created yet (migration pending) — fall back to defaults.
  }

  const fast2smsApiKey = storedKey || process.env.FAST2SMS_API_KEY || null;

  // In development the OTP is surfaced in the UI, so a missing provider must not
  // block testing. In production a channel is only active once it can deliver.
  const smsReady = Boolean(fast2smsApiKey) || !isProduction();
  const emailReady = emailDeliveryConfigured() || !isProduction();

  const wantsEmail = method === "EMAIL" || method === "BOTH";
  const wantsPhone = method === "PHONE" || method === "BOTH";

  return {
    method,
    fast2smsApiKey,
    smsReady,
    emailReady,
    smsConfigured: Boolean(fast2smsApiKey),
    emailConfigured: emailDeliveryConfigured(),
    channels: {
      email: wantsEmail && emailReady,
      phone: wantsPhone && smsReady,
    },
  };
}

/** Currently enforced channels — the single source of truth for client + server. */
export async function getEnforcedChannels() {
  const settings = await getVerificationSettings();
  return settings.channels;
}

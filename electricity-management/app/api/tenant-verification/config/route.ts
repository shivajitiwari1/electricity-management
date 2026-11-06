export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  getVerificationSettings,
  parseVerificationMethod,
  type VerificationMethod,
} from "@/lib/tenant-verification-config";
import { maskApiKey } from "@/lib/sms";

const MIGRATION_PENDING = {
  tenantVerificationEnabled: false,
  error: "Tenant Verification is not set up yet on this database (migration pending).",
};

function isMigrationPending(error: any) {
  return error?.code === "P2021" || error?.code === "P2022";
}

async function buildPayload(forAdmin: boolean) {
  const enabled = await prisma.siteConfig.findUnique({
    where: { id: "singleton" },
    select: { tenantVerificationEnabled: true },
  });

  const settings = await getVerificationSettings();

  return {
    tenantVerificationEnabled: enabled?.tenantVerificationEnabled ?? false,
    tenantVerificationMethod: settings.method,
    channels: settings.channels,
    smsReady: settings.smsReady,
    emailReady: settings.emailReady,
    smsConfigured: settings.smsConfigured,
    emailConfigured: settings.emailConfigured,
    ...(forAdmin
      ? {
          fast2smsApiKeyConfigured: Boolean(settings.fast2smsApiKey),
          fast2smsApiKeyMasked: maskApiKey(settings.fast2smsApiKey),
          fast2smsApiKeySource: settings.fast2smsApiKey
            ? process.env.FAST2SMS_API_KEY && settings.fast2smsApiKey === process.env.FAST2SMS_API_KEY
              ? "environment"
              : "database"
            : null,
        }
      : {}),
  };
}

export async function GET() {
  const session = await auth();
  const role = (session?.user as any)?.role as string | undefined;
  if (!session || (role !== "ADMIN" && role !== "MANAGER" && role !== "RESIDENT")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    return NextResponse.json(await buildPayload(role === "ADMIN" || role === "MANAGER"));
  } catch (error: any) {
    if (isMigrationPending(error)) {
      // Table or column not created yet (migration pending)
      return NextResponse.json({
        tenantVerificationEnabled: false,
        tenantVerificationMethod: "PHONE",
        channels: { email: false, phone: false },
        smsReady: false,
        emailReady: false,
      });
    }
    throw error;
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const role = (session?.user as any)?.role as string | undefined;
  const userEmail = (session?.user as any)?.email as string | undefined;

  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const hasMethod = typeof body?.tenantVerificationMethod === "string";
  const hasApiKey =
    body?.fast2smsApiKey !== undefined && body?.fast2smsApiKey !== null;

  // Changing the verification method or the SMS key is an ADMIN action.
  if (hasMethod || hasApiKey) {
    if (role !== "ADMIN") {
      return NextResponse.json(
        { error: "Only an admin can change the verification settings" },
        { status: 403 }
      );
    }
  } else if (userEmail !== "admin@oasis.local") {
    // Legacy module toggle stays restricted to the super admin.
    return NextResponse.json(
      { error: "Tenant Verification module can only be toggled by the super admin" },
      { status: 403 }
    );
  }

  try {
    const data: Record<string, unknown> = {};

    if (hasMethod) {
      const method: VerificationMethod = parseVerificationMethod(body.tenantVerificationMethod);
      data.tenantVerificationMethod = method;
    }

    if (hasApiKey) {
      const raw = String(body.fast2smsApiKey).trim();
      data.fast2smsApiKey = raw || null;
    }

    if (Object.keys(data).length === 0) {
      // No settings supplied — toggle the module on or off.
      const current = await prisma.siteConfig.findUnique({
        where: { id: "singleton" },
        select: { tenantVerificationEnabled: true },
      });
      data.tenantVerificationEnabled = !current?.tenantVerificationEnabled;
    }

    await prisma.siteConfig.upsert({
      where: { id: "singleton" },
      create: { id: "singleton", ...data },
      update: data,
    });

    return NextResponse.json(await buildPayload(true));
  } catch (error: any) {
    if (isMigrationPending(error)) {
      return NextResponse.json(MIGRATION_PENDING, { status: 503 });
    }
    throw error;
  }
}

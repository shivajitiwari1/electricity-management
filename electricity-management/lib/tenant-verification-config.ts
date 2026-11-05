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

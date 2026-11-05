export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const MIGRATION_PENDING = {
  tenantVerificationEnabled: false,
  error: "Tenant Verification is not set up yet on this database (migration pending).",
};

export async function GET() {
  const session = await auth();
  const role = (session?.user as any)?.role as string | undefined;
  if (!session || (role !== "ADMIN" && role !== "MANAGER" && role !== "RESIDENT")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const config = await prisma.siteConfig.findUnique({
      where: { id: "singleton" },
      select: { tenantVerificationEnabled: true },
    });
    return NextResponse.json({ tenantVerificationEnabled: config?.tenantVerificationEnabled ?? false });
  } catch (error: any) {
    if (error?.code === "P2021" || error?.code === "P2022") {
      // Table or column not created yet (migration pending)
      return NextResponse.json({ tenantVerificationEnabled: false });
    }
    throw error;
  }
}

export async function POST() {
  const session = await auth();
  const userEmail = (session?.user as any)?.email as string | undefined;
  if (userEmail !== "admin@oasis.local") {
    return NextResponse.json(
      { error: "Tenant Verification module can only be toggled by the super admin" },
      { status: 403 }
    );
  }
  try {
    const current = await prisma.siteConfig.findUnique({
      where: { id: "singleton" },
      select: { tenantVerificationEnabled: true },
    });
    const updated = await prisma.siteConfig.update({
      where: { id: "singleton" },
      data: { tenantVerificationEnabled: !current?.tenantVerificationEnabled },
    });
    return NextResponse.json({ tenantVerificationEnabled: updated.tenantVerificationEnabled });
  } catch (error: any) {
    if (error?.code === "P2021" || error?.code === "P2022") {
      return NextResponse.json(MIGRATION_PENDING, { status: 503 });
    }
    throw error;
  }
}

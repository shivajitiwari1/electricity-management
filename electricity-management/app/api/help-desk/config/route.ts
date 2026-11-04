export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const upsertSingleton = () =>
  prisma.siteConfig.upsert({
    where: { id: "singleton" },
    create: {
      id: "singleton",
      maintenanceMode: false,
      maintenanceBillingEnabled: false,
      helpDeskEnabled: false,
      cgstRate: 9,
      sgstRate: 9,
    },
    update: {},
  });

export async function GET() {
  const session = await auth();
  const role = (session?.user as any)?.role as string | undefined;
  if (role !== "ADMIN" && role !== "MANAGER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const config = await upsertSingleton();
  return NextResponse.json({ helpDeskEnabled: config.helpDeskEnabled });
}

export async function POST() {
  const session = await auth();
  const role = (session?.user as any)?.role as string | undefined;
  if (role !== "ADMIN") {
    return NextResponse.json({ error: "Help Desk module can only be toggled by an ADMIN" }, { status: 401 });
  }
  const current = await upsertSingleton();
  const updated = await prisma.siteConfig.update({
    where: { id: "singleton" },
    data: { helpDeskEnabled: !current.helpDeskEnabled },
  });
  return NextResponse.json({ helpDeskEnabled: updated.helpDeskEnabled });
}

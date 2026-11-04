import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function helpDeskEnabled() {
  const config = await prisma.siteConfig.findUnique({
    where: { id: "singleton" },
    select: { helpDeskEnabled: true },
  });
  return config?.helpDeskEnabled ?? false;
}

/** Returns a 503 NextResponse when the Help Desk module is disabled, or null. */
export async function guardHelpDeskEnabled() {
  const enabled = await helpDeskEnabled();
  if (enabled) return null;
  return NextResponse.json(
    { error: "Help Desk is disabled. Enable it from Help Desk settings first." },
    { status: 503 }
  );
}

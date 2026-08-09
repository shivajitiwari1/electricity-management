import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidateTag } from "next/cache";

async function getAdminSession() {
  const session = await auth();
  if (!session) return null;
  if ((session.user as any)?.role !== "ADMIN") return null;
  return session;
}

export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const config = await prisma.siteConfig.upsert({
    where:  { id: "singleton" },
    create: { id: "singleton", maintenanceMode: false },
    update: {},
  });
  return NextResponse.json({ maintenanceMode: config.maintenanceMode });
}

export async function POST() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const current = await prisma.siteConfig.upsert({
    where:  { id: "singleton" },
    create: { id: "singleton", maintenanceMode: false },
    update: {},
  });

  const updated = await prisma.siteConfig.update({
    where: { id: "singleton" },
    data:  { maintenanceMode: !current.maintenanceMode },
  });

  revalidateTag("site-config", {});
  return NextResponse.json({ maintenanceMode: updated.maintenanceMode });
}

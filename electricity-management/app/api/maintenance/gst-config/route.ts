import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  const role = (session?.user as any)?.role as string | undefined;
  if (role !== "ADMIN" && role !== "MANAGER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const config = await prisma.siteConfig.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", maintenanceMode: false, cgstRate: 9, sgstRate: 9 },
    update: {},
  });

  return NextResponse.json({
    cgstRate: Number(config.cgstRate),
    sgstRate: Number(config.sgstRate),
  });
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  const role = (session?.user as any)?.role as string | undefined;
  if (role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { cgstRate, sgstRate } = await req.json();

  if (
    typeof cgstRate !== "number" || typeof sgstRate !== "number" ||
    cgstRate < 0 || cgstRate > 100 || sgstRate < 0 || sgstRate > 100
  ) {
    return NextResponse.json({ error: "Invalid GST rates" }, { status: 400 });
  }

  const config = await prisma.siteConfig.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", maintenanceMode: false, cgstRate, sgstRate },
    update: { cgstRate, sgstRate },
  });

  return NextResponse.json({
    cgstRate: Number(config.cgstRate),
    sgstRate: Number(config.sgstRate),
  });
}

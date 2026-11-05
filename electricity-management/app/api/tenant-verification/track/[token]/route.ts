export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const application = await prisma.tenantApplication.findUnique({
    where: { applicationToken: token },
    select: {
      id: true,
      applicationNumber: true,
      status: true,
      tenantName: true,
      tenantPhone: true,
      connection: { select: { flatNo: true, tower: true } },
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!application) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ application });
}

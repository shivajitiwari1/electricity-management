import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function POST() {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const connections = await prisma.connection.findMany({
    select: { id: true, flatNo: true, meterNo: true },
  });

  let updated = 0;
  for (const c of connections) {
    if (!c.meterNo || c.meterNo.trim() === "") {
      await prisma.connection.update({
        where: { id: c.id },
        data: { meterNo: c.flatNo },
      });
      updated++;
    }
  }

  return NextResponse.json({ updated, total: connections.length });
}

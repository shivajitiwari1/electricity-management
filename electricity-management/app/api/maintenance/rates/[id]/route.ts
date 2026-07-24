import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { guardPermission } from "@/lib/permissions";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const guard = await guardPermission(session as any, "maintenance", "canWrite");
  if (guard) return guard;

  const { id } = await params;

  // Only allow deleting historical (non-current) rates
  const rates = await prisma.maintenanceRate.findMany({
    orderBy: { effectiveFrom: "desc" },
    select: { id: true },
  });

  if (rates.length === 0) return NextResponse.json({ error: "Rate not found" }, { status: 404 });

  const currentId = rates[0].id;
  if (id === currentId) {
    return NextResponse.json({ error: "Cannot delete the current rate" }, { status: 422 });
  }

  const target = rates.find((r) => r.id === id);
  if (!target) return NextResponse.json({ error: "Rate not found" }, { status: 404 });

  await prisma.maintenanceRate.delete({ where: { id } });
  return NextResponse.json({ success: true });
}

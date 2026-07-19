import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidateTag } from "next/cache";
import { guardPermission } from "@/lib/permissions";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const guard = await guardPermission(session as any, "rates", "canDelete");
  if (guard) return guard;

  const { id } = await params;

  // Find the rate to delete
  const rate = await prisma.rate.findUnique({ where: { id } });
  if (!rate) {
    return NextResponse.json({ error: "Rate not found" }, { status: 404 });
  }

  // Prevent deleting the current (most recent) rate
  const latestRate = await prisma.rate.findFirst({
    orderBy: { effectiveFrom: "desc" },
  });
  if (latestRate?.id === id) {
    return NextResponse.json(
      { error: "Cannot delete the current rate" },
      { status: 400 }
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.rate.delete({ where: { id } });

    await tx.auditLog.create({
      data: {
        userId: session!.user.id,
        action: "DELETE",
        entity: "Rate",
        entityId: id,
        meta: {
          ncplPerUnit: rate.ncplPerUnit.toString(),
          dgFixed: rate.dgFixed.toString(),
          fixedPerKw: rate.fixedPerKw.toString(),
          effectiveFrom: rate.effectiveFrom,
        },
      },
    });
  });

  revalidateTag("rates", {});
  revalidateTag("dashboard", {});
  return NextResponse.json({ success: true });
}

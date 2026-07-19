import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidateTag } from "next/cache";
import { guardPermission } from "@/lib/permissions";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session || ((session.user as any).role !== "ADMIN" && (session.user as any).role !== "MANAGER")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const reading = await prisma.meterReading.findUnique({
    where: { id },
    include: {
      connection: {
        include: {
          resident: {
            include: {
              user: { select: { id: true, name: true, email: true } },
            },
          },
        },
      },
      bill: true,
    },
  });

  if (!reading) {
    return NextResponse.json({ error: "Meter reading not found" }, { status: 404 });
  }

  return NextResponse.json(reading);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const guard = await guardPermission(session as any, "meter-readings", "canDelete");
  if (guard) return guard;

  const { id } = await params;

  const reading = await prisma.meterReading.findUnique({
    where: { id },
    include: { bill: true },
  });

  if (!reading) {
    return NextResponse.json({ error: "Meter reading not found" }, { status: 404 });
  }

  await prisma.$transaction(async (tx) => {
    // Cascade: delete payments → bill → meter reading
    if (reading.bill) {
      await tx.payment.deleteMany({ where: { billId: reading.bill.id } });
      await tx.bill.delete({ where: { id: reading.bill.id } });
    }
    await tx.meterReading.delete({ where: { id } });

    await tx.auditLog.create({
      data: {
        userId: session!.user.id,
        action: "DELETE",
        entity: "MeterReading",
        entityId: id,
        meta: {
          connectionId: reading.connectionId,
          readingDate: reading.readingDate,
          billDeleted: !!reading.bill,
        },
      },
    });
  });

  revalidateTag("meter-readings", {});
  revalidateTag("dashboard", {});
  revalidateTag("reports", {});
  return NextResponse.json({ success: true });
}

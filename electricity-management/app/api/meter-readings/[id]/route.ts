import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
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
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const reading = await prisma.meterReading.findUnique({
    where: { id },
    include: { bill: true },
  });

  if (!reading) {
    return NextResponse.json({ error: "Meter reading not found" }, { status: 404 });
  }

  if (reading.bill) {
    return NextResponse.json(
      { error: "Cannot delete meter reading: a bill is linked to it" },
      { status: 409 }
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.meterReading.delete({ where: { id } });

    await tx.auditLog.create({
      data: {
        userId: session.user.id,
        action: "DELETE",
        entity: "MeterReading",
        entityId: id,
        meta: {
          connectionId: reading.connectionId,
          readingDate: reading.readingDate,
        },
      },
    });
  });

  return NextResponse.json({ success: true });
}

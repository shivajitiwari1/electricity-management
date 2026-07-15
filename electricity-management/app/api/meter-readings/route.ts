import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { Decimal } from "@prisma/client/runtime/client";

const createMeterReadingSchema = z.object({
  connectionId: z.string().min(1),
  readingDate: z.string().min(1),
  ncplPrevious: z.number(),
  ncplCurrent: z.number(),
  dgPrevious: z.number().optional(),
  dgCurrent: z.number().optional(),
});

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const connectionId = searchParams.get("connectionId");

  const readings = await prisma.meterReading.findMany({
    where: connectionId ? { connectionId } : undefined,
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
    },
    orderBy: { readingDate: "desc" },
  });

  return NextResponse.json(readings);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createMeterReadingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const {
    connectionId,
    readingDate,
    ncplPrevious,
    ncplCurrent,
    dgPrevious,
    dgCurrent,
  } = parsed.data;

  // Verify connection exists
  const connection = await prisma.connection.findUnique({
    where: { id: connectionId },
  });
  if (!connection) {
    return NextResponse.json({ error: "Connection not found" }, { status: 404 });
  }

  const ncplUnits = new Decimal(ncplCurrent).sub(new Decimal(ncplPrevious));
  const dgUnitsVal = dgCurrent !== undefined && dgPrevious !== undefined
    ? new Decimal(dgCurrent).sub(new Decimal(dgPrevious))
    : new Decimal(0);

  const reading = await prisma.$transaction(async (tx) => {
    const newReading = await tx.meterReading.create({
      data: {
        connectionId,
        readingDate: new Date(readingDate),
        ncplPrevious: new Decimal(ncplPrevious),
        ncplCurrent: new Decimal(ncplCurrent),
        ncplUnits,
        dgPrevious: dgPrevious !== undefined ? new Decimal(dgPrevious) : new Decimal(0),
        dgCurrent: dgCurrent !== undefined ? new Decimal(dgCurrent) : new Decimal(0),
        dgUnits: dgUnitsVal,
        recordedById: session.user.id,
      },
    });

    await tx.auditLog.create({
      data: {
        userId: session.user.id,
        action: "CREATE",
        entity: "MeterReading",
        entityId: newReading.id,
        meta: {
          connectionId,
          readingDate,
          ncplPrevious,
          ncplCurrent,
          ncplUnits: ncplUnits.toNumber(),
        },
      },
    });

    return newReading;
  });

  return NextResponse.json(reading, { status: 201 });
}

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const updateBillStatusSchema = z.object({
  status: z.enum(["PENDING", "PAID", "OVERDUE"]),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const bill = await prisma.bill.findUnique({
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
      meterReading: true,
      payment: true,
    },
  });

  if (!bill) {
    return NextResponse.json({ error: "Bill not found" }, { status: 404 });
  }

  if (session.user.role === "ADMIN") {
    return NextResponse.json(bill);
  }

  // RESIDENT: verify ownership via session user's resident record
  const resident = await prisma.resident.findUnique({
    where: { userId: session.user.id },
    include: { connections: { select: { id: true } } },
  });

  if (!resident) {
    return NextResponse.json({ error: "Resident record not found" }, { status: 403 });
  }

  const ownsConnection = resident.connections.some(
    (conn) => conn.id === bill.connectionId
  );

  if (!ownsConnection) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json(bill);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = updateBillStatusSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { status } = parsed.data;

  const bill = await prisma.bill.findUnique({ where: { id } });
  if (!bill) {
    return NextResponse.json({ error: "Bill not found" }, { status: 404 });
  }

  const updated = await prisma.$transaction(async (tx) => {
    const updatedBill = await tx.bill.update({
      where: { id },
      data: { status },
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
        meterReading: true,
        payment: true,
      },
    });

    await tx.auditLog.create({
      data: {
        userId: session.user.id,
        action: "UPDATE",
        entity: "Bill",
        entityId: id,
        meta: {
          billNumber: bill.billNumber,
          previousStatus: bill.status,
          newStatus: status,
        },
      },
    });

    return updatedBill;
  });

  return NextResponse.json(updated);
}

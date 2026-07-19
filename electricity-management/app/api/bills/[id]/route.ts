import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { revalidateTag } from "next/cache";
import { guardPermission } from "@/lib/permissions";

const updateBillStatusSchema = z.object({
  status: z.enum(["PENDING", "PAID", "OVERDUE", "PARTIAL"]),
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
      payments: true,
    },
  });

  if (!bill) {
    return NextResponse.json({ error: "Bill not found" }, { status: 404 });
  }

  if ((session.user as any).role === "ADMIN" || (session.user as any).role === "MANAGER") {
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
  const guard = await guardPermission(session as any, "bills", "canWrite");
  if (guard) return guard;

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
        payments: true,
      },
    });

    await tx.auditLog.create({
      data: {
        userId: session!.user.id,
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

  revalidateTag("bills", {});
  revalidateTag("dashboard", {});
  revalidateTag("payments", {});
  revalidateTag("reports", {});
  return NextResponse.json(updated);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const guard = await guardPermission(session as any, "bills", "canDelete");
  if (guard) return guard;

  const { id } = await params;

  const bill = await prisma.bill.findUnique({
    where: { id },
    select: { id: true, billNumber: true },
  });
  if (!bill) {
    return NextResponse.json({ error: "Bill not found" }, { status: 404 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.payment.deleteMany({ where: { billId: id } });
    await tx.bill.delete({ where: { id } });
    await tx.auditLog.create({
      data: {
        userId: session!.user.id,
        action: "DELETE",
        entity: "Bill",
        entityId: id,
        meta: { billNumber: bill.billNumber },
      },
    });
  });

  revalidateTag("bills", {});
  revalidateTag("dashboard", {});
  revalidateTag("payments", {});
  revalidateTag("reports", {});
  return NextResponse.json({ success: true });
}

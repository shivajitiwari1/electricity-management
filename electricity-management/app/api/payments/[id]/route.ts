import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidateTag } from "next/cache";
import { guardPermission } from "@/lib/permissions";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session || ((session.user as any).role !== "ADMIN" && (session.user as any).role !== "MANAGER")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const payment = await prisma.payment.findUnique({
    where: { id },
    include: {
      bill: {
        include: {
          meterReading: true,
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
      },
    },
  });

  if (!payment) {
    return NextResponse.json({ error: "Payment not found" }, { status: 404 });
  }

  return NextResponse.json(payment);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const guard = await guardPermission(session as any, "payments", "canDelete");
  if (guard) return guard;

  const { id } = await params;

  const payment = await prisma.payment.findUnique({
    where: { id },
    include: { bill: { select: { id: true, totalAmount: true, paidAmount: true, status: true } } },
  });
  if (!payment) {
    return NextResponse.json({ error: "Payment not found" }, { status: 404 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.payment.delete({ where: { id } });

    // Recompute bill paidAmount and status after removing this payment
    const newPaidAmount = Math.max(0, Number(payment.bill.paidAmount) - Number(payment.amount));
    const totalAmount = Number(payment.bill.totalAmount);
    let newStatus: "PENDING" | "PARTIAL" | "PAID" | "OVERDUE";
    if (newPaidAmount <= 0) {
      newStatus = payment.bill.status === "OVERDUE" ? "OVERDUE" : "PENDING";
    } else if (newPaidAmount >= totalAmount - 0.01) {
      newStatus = "PAID";
    } else {
      newStatus = "PARTIAL";
    }

    await tx.bill.update({
      where: { id: payment.bill.id },
      data: { paidAmount: newPaidAmount, status: newStatus },
    });

    await tx.auditLog.create({
      data: {
        userId: session!.user.id,
        action: "DELETE",
        entity: "Payment",
        entityId: id,
        meta: {
          receiptNumber: payment.receiptNumber,
          amount: Number(payment.amount),
          billId: payment.bill.id,
          newBillStatus: newStatus,
        },
      },
    });
  });

  revalidateTag("bills", {});
  revalidateTag("dashboard", {});
  revalidateTag("payments", {});
  revalidateTag("reports", {});
  return NextResponse.json({ success: true });
}

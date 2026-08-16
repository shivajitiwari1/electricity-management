import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { guardPermission } from "@/lib/permissions";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const guard = await guardPermission(session as any, "maintenance", "canDelete");
  if (guard) return guard;

  const { id } = await params;

  const payment = await prisma.maintenancePayment.findUnique({
    where: { id },
    select: { id: true, amount: true, maintenanceBillId: true },
  });

  if (!payment) return NextResponse.json({ error: "Payment not found" }, { status: 404 });

  await prisma.$transaction(async (tx) => {
    await tx.maintenancePayment.delete({ where: { id } });

    const bill = await tx.maintenanceBill.findUnique({
      where: { id: payment.maintenanceBillId },
      select: { paidAmount: true, amount: true, previousDue: true, interestCharge: true },
    });

    if (bill) {
      const newPaidAmount = Math.max(0, Number(bill.paidAmount) - Number(payment.amount));
      const total = Number(bill.amount) + Number(bill.previousDue) + Number(bill.interestCharge);
      const newStatus = newPaidAmount <= 0 ? "PENDING" : newPaidAmount >= total ? "PAID" : "PARTIAL";
      await tx.maintenanceBill.update({
        where: { id: payment.maintenanceBillId },
        data: { paidAmount: newPaidAmount, status: newStatus },
      });
    }
  });

  return NextResponse.json({ deleted: true });
}

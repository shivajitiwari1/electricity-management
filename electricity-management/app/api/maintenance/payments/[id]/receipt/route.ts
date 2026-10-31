export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { generateReceiptPdf, ReceiptData } from "@/lib/pdf";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const payment = await prisma.maintenancePayment.findUnique({
    where: { id },
    include: {
      bill: {
        include: {
          connection: {
            include: {
              resident: {
                include: {
                  user: { select: { name: true, email: true } },
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

  // A rebate / waiver is not money received, so it gets no receipt of its own.
  // It is shown as a deduction on the receipt of the payment it was applied with.
  if (payment.method === "ADJUSTMENT") {
    return NextResponse.json(
      { error: "No receipt is issued for a rebate / waiver adjustment." },
      { status: 400 }
    );
  }

  // All SUCCESS payments on this bill, so we can state the balance as it stood
  // at the moment of this payment rather than as it stands today. A receipt is a
  // historical document: a reprint must not change because later payments landed.
  const allPayments = await prisma.maintenancePayment.findMany({
    where: { maintenanceBillId: payment.maintenanceBillId, status: "SUCCESS" },
    select: { id: true, amount: true, paymentDate: true, createdAt: true, method: true },
  });

  // The rebate row is written in the same transaction as its payment, so it
  // shares a paymentDate and lands within the same second.
  const rebatePayments = allPayments.filter(
    (p) =>
      p.method === "ADJUSTMENT" &&
      p.id !== payment.id &&
      Math.abs(p.createdAt.getTime() - payment.createdAt.getTime()) <= 5000
  );
  const rebateAmount = rebatePayments.reduce((sum, p) => sum + Number(p.amount), 0);
  const rebateIds = new Set(rebatePayments.map((p) => p.id));

  const isUpToThisPayment = (p: (typeof allPayments)[number]) =>
    p.paymentDate.getTime() < payment.paymentDate.getTime() ||
    (p.paymentDate.getTime() === payment.paymentDate.getTime() &&
      p.createdAt.getTime() <= payment.createdAt.getTime());

  const billTotal = Math.round(
    Number(payment.bill.amount) +
      Number(payment.bill.previousDue) +
      Number(payment.bill.interestCharge)
  );
  // This payment and its rebate are settled by this receipt, so count them
  // explicitly. The rebate row is inserted microseconds after the payment,
  // which is why a plain isUpToThisPayment filter drops it and makes the
  // receipt claim the waived amount is still outstanding.
  const paidSoFar =
    allPayments
      .filter((p) => p.id !== payment.id && !rebateIds.has(p.id) && isUpToThisPayment(p))
      .reduce((sum, p) => sum + Number(p.amount), 0) +
    Number(payment.amount) +
    rebateAmount;
  const balanceDue = Math.max(0, Math.round(billTotal - paidSoFar));

  const receiptData: ReceiptData = {
    receiptNumber: payment.receiptNumber,
    residentName: payment.bill.connection.resident?.user?.name ?? "Resident",
    flatNo: payment.bill.connection.flatNo,
    billNumber: payment.bill.billNumber,
    amount: Math.round(Number(payment.amount)),
    paymentDate: payment.paymentDate,
    razorpayPaymentId: payment.razorpayPaymentId ?? undefined,
    method: payment.method,
    rebateAmount: rebateAmount > 0 ? Math.round(rebateAmount) : undefined,
    billTotal,
    balanceDue,
    title: "MAINTENANCE PAYMENT RECEIPT",
  };

  const buffer = await generateReceiptPdf(receiptData);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="receipt-${payment.receiptNumber}.pdf"`,
    },
  });
}

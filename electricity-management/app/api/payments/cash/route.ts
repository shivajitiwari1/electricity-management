import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { nextReceiptNumber } from "@/lib/billing";
import { sendEmail } from "@/lib/email";
import { paymentSuccessEmail } from "@/lib/email-templates";

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

  const { billId, amount: amountParam } = body as { billId?: string; amount?: number };
  if (!billId) {
    return NextResponse.json({ error: "billId is required" }, { status: 400 });
  }

  const bill = await prisma.bill.findUnique({
    where: { id: billId },
    include: {
      connection: {
        include: {
          resident: {
            include: { user: { select: { name: true, email: true } } },
          },
        },
      },
    },
  });
  if (!bill) {
    return NextResponse.json({ error: "Bill not found" }, { status: 404 });
  }
  if (bill.status === "PAID") {
    return NextResponse.json({ error: "Bill already paid" }, { status: 409 });
  }

  const totalAmount = Number(bill.totalAmount);
  const alreadyPaid = Number(bill.paidAmount);
  const remaining = totalAmount - alreadyPaid;

  if (remaining <= 0) {
    return NextResponse.json({ error: "Bill already fully paid" }, { status: 409 });
  }

  // Determine payment amount — default to remaining balance
  let payAmount = amountParam != null ? Number(amountParam) : remaining;
  if (isNaN(payAmount) || payAmount <= 0) {
    return NextResponse.json({ error: "Amount must be greater than 0" }, { status: 400 });
  }
  if (payAmount > remaining) {
    return NextResponse.json({ error: `Amount cannot exceed remaining balance of ₹${remaining.toFixed(2)}` }, { status: 400 });
  }

  const newPaidAmount = alreadyPaid + payAmount;
  const isFullyPaid = newPaidAmount >= totalAmount - 0.01; // allow tiny rounding
  const newStatus = isFullyPaid ? "PAID" : "PARTIAL";

  const receiptNumber = await nextReceiptNumber();

  const payment = await prisma.$transaction(async (tx) => {
    const newPayment = await tx.payment.create({
      data: {
        billId,
        amount: payAmount,
        paymentDate: new Date(),
        method: "CASH",
        status: "SUCCESS",
        receiptNumber,
      },
    });

    await tx.bill.update({
      where: { id: billId },
      data: { status: newStatus, paidAmount: newPaidAmount },
    });

    return newPayment;
  });

  // Send confirmation email
  try {
    const resident = bill.connection.resident;
    const receiptUrl = `${process.env.NEXTAUTH_URL}/api/pdf/receipt/${payment.id}`;
    const html = paymentSuccessEmail({
      residentName: resident.user.name ?? "Resident",
      flatNo: bill.connection.flatNo,
      receiptNumber,
      amount: payAmount.toFixed(2),
      paymentDate: payment.paymentDate.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }),
      razorpayPaymentId: "CASH",
      receiptUrl,
    });
    await sendEmail(resident.user.email, `Payment Received — ${bill.billNumber}`, html);
  } catch (err) {
    console.error("Cash payment email failed:", err);
  }

  return NextResponse.json({
    success: true,
    receiptNumber,
    paymentId: payment.id,
    isFullyPaid,
    newStatus,
    paidAmount: newPaidAmount,
    remaining: totalAmount - newPaidAmount,
  });
}

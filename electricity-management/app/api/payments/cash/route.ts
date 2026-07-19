import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { nextReceiptNumber } from "@/lib/billing";
import { guardPermission } from "@/lib/permissions";
import { sendEmail } from "@/lib/email";
import { paymentSuccessEmail } from "@/lib/email-templates";
import { revalidateTag } from "next/cache";

const ALLOWED_METHODS = ["CASH", "UPI", "NEFT", "RTGS", "CHEQUE"] as const;
type ManualMethod = (typeof ALLOWED_METHODS)[number];

export async function POST(req: NextRequest) {
  const session = await auth();
  const guard = await guardPermission(session as any, "payments", "canWrite");
  if (guard) return guard;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const {
    billId,
    amount: amountParam,
    method: methodParam = "CASH",
    referenceId = null,
    paymentDate: paymentDateParam = null,
  } = body as {
    billId?: string;
    amount?: number;
    method?: string;
    referenceId?: string | null;
    paymentDate?: string | null;
  };

  if (!billId) {
    return NextResponse.json({ error: "billId is required" }, { status: 400 });
  }

  const method = (ALLOWED_METHODS as readonly string[]).includes(methodParam)
    ? (methodParam as ManualMethod)
    : "CASH";

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

  let payAmount = amountParam != null ? Number(amountParam) : remaining;
  if (isNaN(payAmount) || payAmount <= 0) {
    return NextResponse.json({ error: "Amount must be greater than 0" }, { status: 400 });
  }
  if (payAmount > remaining) {
    return NextResponse.json({ error: `Amount cannot exceed remaining balance of ₹${remaining.toFixed(2)}` }, { status: 400 });
  }

  const newPaidAmount = alreadyPaid + payAmount;
  const isFullyPaid = newPaidAmount >= totalAmount - 0.01;
  const newStatus = isFullyPaid ? "PAID" : "PARTIAL";
  const receiptNumber = await nextReceiptNumber();
  const pDate = paymentDateParam ? new Date(paymentDateParam) : new Date();

  const payment = await prisma.$transaction(async (tx) => {
    const newPayment = await tx.payment.create({
      data: {
        billId,
        amount: payAmount,
        paymentDate: pDate,
        method,
        status: "SUCCESS",
        receiptNumber,
        razorpayPaymentId: referenceId ?? (method === "CASH" ? "CASH" : null),
      },
    });
    await tx.bill.update({
      where: { id: billId },
      data: { status: newStatus, paidAmount: newPaidAmount },
    });
    return newPayment;
  });

  // Send email receipt
  try {
    const resident = bill.connection.resident;
    const receiptUrl = `${process.env.NEXTAUTH_URL}/api/pdf/receipt/${payment.id}`;
    const html = paymentSuccessEmail({
      residentName: resident.user.name ?? "Resident",
      flatNo: bill.connection.flatNo,
      receiptNumber,
      amount: payAmount.toFixed(2),
      paymentDate: pDate.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }),
      razorpayPaymentId: referenceId ?? method,
      receiptUrl,
    });
    await sendEmail(resident.user.email, `Payment Received — ${bill.billNumber}`, html);
  } catch (err) {
    console.error("Payment email failed:", err);
  }

  revalidateTag("bills", {});
  revalidateTag("dashboard", {});
  revalidateTag("payments", {});
  revalidateTag("reports", {});
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

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPaymentToken } from "@/lib/payment-token";
import { nextReceiptNumber } from "@/lib/billing";
import { sendEmail } from "@/lib/email";
import { paymentSuccessEmail } from "@/lib/email-templates";

export async function POST(req: NextRequest) {
  const keyId = process.env.RAZORPAY_KEY_ID ?? "";
  if (!keyId.includes("REPLACE") && keyId.startsWith("rzp_live_")) {
    return NextResponse.json({ error: "Test payments disabled in live mode" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { token } = body as { token?: string };
  if (!token) return NextResponse.json({ error: "Token required" }, { status: 400 });

  const billId = verifyPaymentToken(token);
  if (!billId) return NextResponse.json({ error: "Invalid payment link" }, { status: 403 });

  const bill = await prisma.bill.findUnique({
    where: { id: billId },
    include: {
      connection: {
        include: { resident: { include: { user: { select: { name: true, email: true } } } } },
      },
    },
  });
  if (!bill) return NextResponse.json({ error: "Bill not found" }, { status: 404 });
  if (bill.status === "PAID") return NextResponse.json({ error: "Already paid" }, { status: 409 });

  const receiptNumber = await nextReceiptNumber();
  const testPaymentId = `TEST_${Date.now()}`;

  const payment = await prisma.$transaction(async (tx) => {
    const p = await tx.payment.create({
      data: {
        billId,
        amount: bill.totalAmount,
        paymentDate: new Date(),
        method: "ONLINE",
        razorpayOrderId: `TEST_ORDER_${Date.now()}`,
        razorpayPaymentId: testPaymentId,
        razorpaySignature: "TEST_SIGNATURE",
        status: "SUCCESS",
        receiptNumber,
      },
    });
    await tx.bill.update({ where: { id: billId }, data: { status: "PAID" } });
    return p;
  });

  try {
    const resident = bill.connection.resident;
    const html = paymentSuccessEmail({
      residentName: resident.user.name ?? "Resident",
      flatNo: bill.connection.flatNo,
      receiptNumber,
      amount: bill.totalAmount.toFixed(2),
      paymentDate: payment.paymentDate.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
      razorpayPaymentId: testPaymentId,
      receiptUrl: `${process.env.NEXTAUTH_URL}/api/pdf/receipt/${payment.id}`,
    });
    await sendEmail(resident.user.email, `Payment Received — ${bill.billNumber}`, html);
  } catch (err) {
    console.error("Email failed:", err);
  }

  return NextResponse.json({ success: true, receiptNumber, paymentId: payment.id });
}

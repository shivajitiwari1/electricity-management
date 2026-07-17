import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPaymentToken } from "@/lib/payment-token";
import { nextReceiptNumber } from "@/lib/billing";
import { sendEmail } from "@/lib/email";
import { paymentSuccessEmail } from "@/lib/email-templates";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { token, razorpayOrderId, razorpayPaymentId, razorpaySignature } = body as {
    token?: string;
    razorpayOrderId?: string;
    razorpayPaymentId?: string;
    razorpaySignature?: string;
  };

  if (!token || !razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const billId = verifyPaymentToken(token);
  if (!billId) return NextResponse.json({ error: "Invalid payment link" }, { status: 403 });

  // Verify Razorpay signature
  const expected = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest("hex");
  if (expected !== razorpaySignature) {
    return NextResponse.json({ error: "Invalid payment signature" }, { status: 400 });
  }

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

  const payment = await prisma.$transaction(async (tx) => {
    const p = await tx.payment.create({
      data: {
        billId,
        amount: bill.totalAmount,
        paymentDate: new Date(),
        method: "ONLINE",
        razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature,
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
      razorpayPaymentId,
      receiptUrl: `${process.env.NEXTAUTH_URL}/api/pdf/receipt/${payment.id}`,
    });
    await sendEmail(resident.user.email, `Payment Received — ${bill.billNumber}`, html);
  } catch (err) {
    console.error("Email failed:", err);
  }

  return NextResponse.json({ success: true, receiptNumber, paymentId: payment.id });
}

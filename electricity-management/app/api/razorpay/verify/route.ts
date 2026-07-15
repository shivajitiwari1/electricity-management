import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { paymentSuccessEmail } from "@/lib/email-templates";
import { generateReceiptNumber } from "@/lib/billing";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "RESIDENT") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { razorpayOrderId, razorpayPaymentId, razorpaySignature, billId } =
    body as {
      razorpayOrderId?: string;
      razorpayPaymentId?: string;
      razorpaySignature?: string;
      billId?: string;
    };

  if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature || !billId) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 }
    );
  }

  // Verify HMAC signature
  const bodyStr = `${razorpayOrderId}|${razorpayPaymentId}`;
  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
    .update(bodyStr)
    .digest("hex");

  if (expectedSignature !== razorpaySignature) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // Fetch bill with resident info
  const bill = await prisma.bill.findUnique({
    where: { id: billId },
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
  });

  if (!bill) {
    return NextResponse.json({ error: "Bill not found" }, { status: 404 });
  }

  // Generate receipt number
  const count = await prisma.payment.count();
  const receiptNumber = generateReceiptNumber(new Date(), count + 1);

  // Create payment and update bill in a transaction
  const payment = await prisma.$transaction(async (tx) => {
    const newPayment = await tx.payment.create({
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

    await tx.bill.update({
      where: { id: billId },
      data: { status: "PAID" },
    });

    return newPayment;
  });

  // Send payment success email — don't fail if email errors
  try {
    const resident = bill.connection.resident;
    const residentEmail = resident.user.email;
    const residentName = resident.user.name ?? "Resident";
    const receiptUrl = `${process.env.NEXTAUTH_URL}/api/pdf/receipt/${payment.id}`;

    const html = paymentSuccessEmail({
      residentName,
      flatNo: bill.connection.flatNo,
      receiptNumber,
      amount: bill.totalAmount.toFixed(2),
      paymentDate: payment.paymentDate.toDateString(),
      razorpayPaymentId,
      receiptUrl,
    });

    await sendEmail(
      residentEmail,
      `Payment Successful - ${bill.billNumber}`,
      html
    );
  } catch (emailErr) {
    console.error("Failed to send payment success email:", emailErr);
  }

  return NextResponse.json({
    success: true,
    receiptNumber,
    paymentId: payment.id,
  });
}

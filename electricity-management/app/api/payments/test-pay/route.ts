import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { nextReceiptNumber } from "@/lib/billing";
import { sendEmail } from "@/lib/email";
import { paymentSuccessEmail } from "@/lib/email-templates";

// Demo-only endpoint — simulates a successful payment without Razorpay.
// Only active when RAZORPAY_KEY_ID is not a real key (contains "REPLACE").
export async function POST(req: NextRequest) {
  const keyId = process.env.RAZORPAY_KEY_ID ?? "";
  if (!keyId.includes("REPLACE") && keyId.startsWith("rzp_live_")) {
    return NextResponse.json(
      { error: "Test payments are disabled in live mode" },
      { status: 403 }
    );
  }

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

  const { billId } = body as { billId?: string };
  if (!billId) {
    return NextResponse.json({ error: "billId is required" }, { status: 400 });
  }

  const bill = await prisma.bill.findUnique({
    where: { id: billId },
    include: {
      connection: {
        include: {
          resident: {
            include: { user: { select: { id: true, name: true, email: true } } },
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

  if (bill.connection.resident.userId !== session.user.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const receiptNumber = await nextReceiptNumber();
  const testPaymentId = `TEST_${Date.now()}`;

  const payment = await prisma.$transaction(async (tx) => {
    const newPayment = await tx.payment.create({
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

    await tx.bill.update({
      where: { id: billId },
      data: { status: "PAID" },
    });

    return newPayment;
  });

  // Send payment confirmation email
  try {
    const resident = bill.connection.resident;
    const receiptUrl = `${process.env.NEXTAUTH_URL}/api/pdf/receipt/${payment.id}`;
    const html = paymentSuccessEmail({
      residentName: resident.user.name ?? "Resident",
      flatNo: bill.connection.flatNo,
      receiptNumber,
      amount: bill.totalAmount.toFixed(2),
      paymentDate: payment.paymentDate.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }),
      razorpayPaymentId: testPaymentId,
      receiptUrl,
    });
    await sendEmail(resident.user.email, `Payment Received — ${bill.billNumber}`, html);
  } catch (err) {
    console.error("Test pay email failed:", err);
  }

  return NextResponse.json({
    success: true,
    receiptNumber,
    paymentId: payment.id,
  });
}

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { paymentSuccessEmail } from "@/lib/email-templates";
import { nextMaintenanceReceiptNumber } from "@/lib/maintenance-billing";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || (session.user as any).role !== "RESIDENT") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { razorpayOrderId, razorpayPaymentId, razorpaySignature, maintenanceBillId } =
    body as { razorpayOrderId?: string; razorpayPaymentId?: string; razorpaySignature?: string; maintenanceBillId?: string };

  if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature || !maintenanceBillId) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest("hex");

  if (expectedSignature !== razorpaySignature) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const bill = await prisma.maintenanceBill.findUnique({
    where: { id: maintenanceBillId },
    include: {
      connection: {
        include: {
          resident: { include: { user: { select: { id: true, name: true, email: true } } } },
        },
      },
    },
  });

  if (!bill) return NextResponse.json({ error: "Bill not found" }, { status: 404 });

  const totalDue = Number(bill.amount) + Number(bill.interestCharge);
  const receiptNumber = await nextMaintenanceReceiptNumber();

  const payment = await prisma.$transaction(async (tx) => {
    const newPayment = await tx.maintenancePayment.create({
      data: {
        maintenanceBillId,
        amount: totalDue - Number(bill.paidAmount),
        paymentDate: new Date(),
        method: "ONLINE",
        razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature,
        status: "SUCCESS",
        receiptNumber,
      },
    });
    await tx.maintenanceBill.update({
      where: { id: maintenanceBillId },
      data: { status: "PAID", paidAmount: totalDue },
    });
    return newPayment;
  });

  try {
    const resident = bill.connection.resident;
    const html = paymentSuccessEmail({
      residentName: resident.user.name ?? "Resident",
      flatNo: bill.connection.flatNo,
      receiptNumber,
      amount: (totalDue - Number(bill.paidAmount)).toFixed(2),
      paymentDate: payment.paymentDate.toDateString(),
      razorpayPaymentId,
      receiptUrl: "",
    });
    await sendEmail(resident.user.email, `Maintenance Payment Successful — ${bill.billNumber}`, html);
  } catch (emailErr) {
    console.error("Maintenance payment email failed:", emailErr);
  }

  return NextResponse.json({ success: true, receiptNumber, paymentId: payment.id });
}

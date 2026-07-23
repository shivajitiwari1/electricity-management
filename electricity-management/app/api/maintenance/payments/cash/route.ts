import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { guardPermission } from "@/lib/permissions";
import { nextMaintenanceReceiptNumber } from "@/lib/maintenance-billing";
import { sendEmail } from "@/lib/email";
import { paymentSuccessEmail } from "@/lib/email-templates";

const ALLOWED_METHODS = ["CASH", "UPI", "NEFT", "RTGS", "CHEQUE"] as const;
type ManualMethod = (typeof ALLOWED_METHODS)[number];

export async function POST(req: NextRequest) {
  const session = await auth();
  const guard = await guardPermission(session as any, "maintenance", "canWrite");
  if (guard) return guard;

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const {
    maintenanceBillId,
    amount: amountParam,
    method: methodParam = "CASH",
    referenceId = null,
    paymentDate: paymentDateParam = null,
  } = body as {
    maintenanceBillId?: string;
    amount?: number;
    method?: string;
    referenceId?: string | null;
    paymentDate?: string | null;
  };

  if (!maintenanceBillId) {
    return NextResponse.json({ error: "maintenanceBillId is required" }, { status: 400 });
  }

  const method = (ALLOWED_METHODS as readonly string[]).includes(methodParam)
    ? (methodParam as ManualMethod)
    : "CASH";

  const bill = await prisma.maintenanceBill.findUnique({
    where: { id: maintenanceBillId },
    include: {
      connection: {
        include: {
          resident: { include: { user: { select: { name: true, email: true } } } },
        },
      },
    },
  });

  if (!bill) return NextResponse.json({ error: "Bill not found" }, { status: 404 });
  if (bill.status === "PAID") return NextResponse.json({ error: "Bill already paid" }, { status: 409 });

  const totalDue = Number(bill.amount) + Number(bill.interestCharge);
  const alreadyPaid = Number(bill.paidAmount);
  const remaining = totalDue - alreadyPaid;

  if (remaining <= 0) return NextResponse.json({ error: "Bill already fully paid" }, { status: 409 });

  let payAmount = amountParam != null ? Number(amountParam) : remaining;
  if (isNaN(payAmount) || payAmount <= 0) {
    return NextResponse.json({ error: "Amount must be greater than 0" }, { status: 400 });
  }
  if (payAmount > remaining + 0.01) {
    return NextResponse.json({ error: `Amount cannot exceed remaining balance of ₹${remaining.toFixed(2)}` }, { status: 400 });
  }

  const newPaidAmount = alreadyPaid + payAmount;
  const isFullyPaid = newPaidAmount >= totalDue - 0.01;
  const newStatus = isFullyPaid ? "PAID" : "PARTIAL";
  const receiptNumber = await nextMaintenanceReceiptNumber();
  const pDate = paymentDateParam ? new Date(paymentDateParam) : new Date();

  const payment = await prisma.$transaction(async (tx) => {
    const newPayment = await tx.maintenancePayment.create({
      data: {
        maintenanceBillId,
        amount: payAmount,
        paymentDate: pDate,
        method,
        status: "SUCCESS",
        receiptNumber,
        razorpayPaymentId: referenceId ?? (method === "CASH" ? "CASH" : null),
      },
    });
    await tx.maintenanceBill.update({
      where: { id: maintenanceBillId },
      data: { status: newStatus, paidAmount: newPaidAmount },
    });
    return newPayment;
  });

  try {
    const resident = bill.connection.resident;
    const html = paymentSuccessEmail({
      residentName: resident.user.name ?? "Resident",
      flatNo: bill.connection.flatNo,
      receiptNumber,
      amount: payAmount.toFixed(2),
      paymentDate: pDate.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
      razorpayPaymentId: referenceId ?? method,
      receiptUrl: "",
    });
    await sendEmail(resident.user.email, `Maintenance Payment Received — ${bill.billNumber}`, html);
  } catch (err) {
    console.error("Maintenance payment email failed:", err);
  }

  return NextResponse.json({ success: true, receiptNumber, paymentId: payment.id, isFullyPaid, newStatus });
}

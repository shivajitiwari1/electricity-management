import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { razorpay } from "@/lib/razorpay";
import { verifyPaymentToken } from "@/lib/payment-token";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { token } = body as { token?: string };
  if (!token) return NextResponse.json({ error: "Token required" }, { status: 400 });

  const billId = verifyPaymentToken(token);
  if (!billId) return NextResponse.json({ error: "Invalid or tampered payment link" }, { status: 403 });

  const bill = await prisma.bill.findUnique({ where: { id: billId } });
  if (!bill) return NextResponse.json({ error: "Bill not found" }, { status: 404 });
  if (bill.status === "PAID") return NextResponse.json({ error: "Bill already paid" }, { status: 409 });

  const order = await razorpay.orders.create({
    amount: Math.round(bill.totalAmount.toNumber() * 100),
    currency: "INR",
    receipt: billId,
  });

  return NextResponse.json({ orderId: order.id, amount: order.amount, currency: "INR" });
}

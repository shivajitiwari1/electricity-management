import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { razorpay } from "@/lib/razorpay";

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

  const { billId } = body as { billId?: string };
  if (!billId) {
    return NextResponse.json({ error: "billId is required" }, { status: 400 });
  }

  // Fetch bill and verify it's unpaid
  const bill = await prisma.bill.findUnique({
    where: { id: billId },
    include: {
      connection: {
        include: {
          resident: true,
        },
      },
    },
  });

  if (!bill) {
    return NextResponse.json({ error: "Bill not found" }, { status: 404 });
  }

  if (bill.status !== "PENDING" && bill.status !== "OVERDUE") {
    return NextResponse.json(
      { error: "Bill is already paid or in an invalid state" },
      { status: 422 }
    );
  }

  // Verify the resident owns this bill
  const resident = await prisma.resident.findUnique({
    where: { userId: session.user.id },
  });

  if (!resident || bill.connection.residentId !== resident.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Create Razorpay order
  const order = await razorpay.orders.create({
    amount: Math.round(bill.totalAmount.toNumber() * 100), // paise
    currency: "INR",
    receipt: billId,
  });

  return NextResponse.json({
    orderId: order.id,
    amount: order.amount,
    currency: "INR",
    keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
  });
}

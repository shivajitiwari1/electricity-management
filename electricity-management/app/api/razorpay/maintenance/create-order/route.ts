import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { razorpay } from "@/lib/razorpay";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || (session.user as any).role !== "RESIDENT") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { maintenanceBillId } = body as { maintenanceBillId?: string };
  if (!maintenanceBillId) {
    return NextResponse.json({ error: "maintenanceBillId is required" }, { status: 400 });
  }

  const bill = await prisma.maintenanceBill.findUnique({
    where: { id: maintenanceBillId },
    include: { connection: { include: { resident: true } } },
  });

  if (!bill) return NextResponse.json({ error: "Bill not found" }, { status: 404 });

  if (bill.status !== "PENDING" && bill.status !== "OVERDUE") {
    return NextResponse.json({ error: "Bill is already paid or invalid state" }, { status: 422 });
  }

  const resident = await prisma.resident.findUnique({ where: { userId: session.user.id } });
  if (!resident || bill.connection.residentId !== resident.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const totalDue = Number(bill.amount) + Number(bill.interestCharge) - Number(bill.paidAmount);

  const order = await razorpay.orders.create({
    amount: Math.round(totalDue * 100),
    currency: "INR",
    receipt: maintenanceBillId,
  });

  return NextResponse.json({
    orderId: order.id,
    amount: order.amount,
    currency: "INR",
    keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
  });
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calculateInterestCharge } from "@/lib/maintenance-billing";

export async function GET(req: NextRequest) {
  const cronSecret = req.headers.get("x-cron-secret");
  if (!cronSecret || cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = new Date();

  const overdueBills = await prisma.maintenanceBill.findMany({
    where: {
      status: { in: ["PENDING", "PARTIAL"] },
      dueDate: { lt: today },
    },
    select: { id: true, amount: true, dueDate: true },
  });

  let updated = 0;

  for (const bill of overdueBills) {
    const interest = calculateInterestCharge(Number(bill.amount), bill.dueDate, today);
    await prisma.maintenanceBill.update({
      where: { id: bill.id },
      data: { status: "OVERDUE", interestCharge: interest },
    });
    updated++;
  }

  return NextResponse.json({ success: true, updated });
}

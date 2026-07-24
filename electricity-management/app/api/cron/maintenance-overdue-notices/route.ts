import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { maintenanceOverdueEmail } from "@/lib/email-templates";

export async function GET(req: NextRequest) {
  const cronSecret = req.headers.get("x-cron-secret");
  if (!cronSecret || cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = new Date();

  const overdueBills = await prisma.maintenanceBill.findMany({
    where: { status: "OVERDUE" },
    include: {
      connection: {
        include: {
          resident: { include: { user: { select: { name: true, email: true } } } },
        },
      },
    },
  });

  let sent = 0;
  let errors = 0;

  for (const bill of overdueBills) {
    try {
      const msPerDay = 1000 * 60 * 60 * 24;
      const daysOverdue = Math.max(1, Math.floor((today.getTime() - bill.dueDate.getTime()) / msPerDay));

      const originalAmount = Number(bill.amount);
      const interestCharge = Number(bill.interestCharge);
      const paidAmount = Number(bill.paidAmount);
      const totalDue = originalAmount + interestCharge - paidAmount;

      if (totalDue <= 0) continue;

      const billingPeriodStr = `${bill.billingPeriodStart.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })} – ${bill.billingPeriodEnd.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}`;
      const resident = bill.connection.resident;

      const html = maintenanceOverdueEmail({
        residentName: resident.user.name ?? "Resident",
        flatNo: bill.connection.flatNo,
        billNumber: bill.billNumber,
        billingPeriod: billingPeriodStr,
        originalAmount: originalAmount.toFixed(2),
        interestCharge: interestCharge.toFixed(2),
        totalDue: totalDue.toFixed(2),
        dueDate: bill.dueDate.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
        daysOverdue,
      });

      await sendEmail(
        resident.user.email,
        `Maintenance Payment Overdue — ${bill.billNumber} — Flat ${bill.connection.flatNo}`,
        html
      );

      sent++;
    } catch (err) {
      console.error(`[cron:maintenance-overdue] Email failed for bill ${bill.id}:`, err);
      errors++;
    }
  }

  return NextResponse.json({ success: true, sent, errors });
}

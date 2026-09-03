import { prisma } from "@/lib/prisma";

export function generateMaintenanceBillNumber(flatNo: string, billingMonth: Date): string {
  const year = billingMonth.getFullYear();
  const month = String(billingMonth.getMonth() + 1).padStart(2, "0");
  return `OM-${flatNo}-${year}${month}`;
}

export async function nextMaintenanceReceiptNumber(reserved: string[] = []): Promise<string> {
  const today = new Date();
  const datePart = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`;
  const prefix = `MRCPT-${datePart}-`;

  const last = await prisma.maintenancePayment.findFirst({
    where: { receiptNumber: { startsWith: prefix } },
    orderBy: { receiptNumber: "desc" },
    select: { receiptNumber: true },
  });
  let seq = last ? parseInt(last.receiptNumber.slice(prefix.length), 10) + 1 : 1;

  for (let attempt = 0; attempt < 20; attempt++, seq++) {
    const candidate = `${prefix}${String(seq).padStart(4, "0")}`;
    if (reserved.includes(candidate)) continue;
    const exists = await prisma.maintenancePayment.findUnique({
      where: { receiptNumber: candidate },
      select: { receiptNumber: true },
    });
    if (!exists) return candidate;
  }

  // Last resort: use timestamp-based suffix
  const ts = Date.now().toString().slice(-6);
  return `${prefix}T${ts}`;
}

export function isLastDayOfMonth(date: Date): boolean {
  const tomorrow = new Date(date);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow.getMonth() !== date.getMonth();
}

export function calculateInterestCharge(amount: number, dueDate: Date, today: Date): number {
  if (today <= dueDate) return 0;
  const msPerDay = 1000 * 60 * 60 * 24;
  const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / msPerDay);
  return Math.round(amount * 0.12 * (daysOverdue / 365) * 100) / 100;
}

/**
 * Due date for a maintenance bill: the last day of the month after the one it
 * bills. Derived from the billing period, never from the day the bill happened
 * to be raised — otherwise one cycle ends up with several different due dates.
 *
 * Built in UTC to match billingPeriodStart, and left at 00:00 so it renders as
 * that day in IST rather than rolling over to the next.
 */
export function maintenanceDueDate(billingPeriodStart: Date): Date {
  const year = billingPeriodStart.getUTCFullYear();
  const monthIndex = billingPeriodStart.getUTCMonth();
  // Day 0 of month+2 is the last day of month+1.
  return new Date(Date.UTC(year, monthIndex + 2, 0));
}

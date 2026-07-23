import { prisma } from "@/lib/prisma";

export function generateMaintenanceBillNumber(flatNo: string, billingMonth: Date): string {
  const year = billingMonth.getFullYear();
  const month = String(billingMonth.getMonth() + 1).padStart(2, "0");
  return `OM-${flatNo}-${year}${month}`;
}

export async function nextMaintenanceReceiptNumber(): Promise<string> {
  const today = new Date();
  const datePart = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`;
  const prefix = `MRCPT-${datePart}-`;
  const last = await prisma.maintenancePayment.findFirst({
    where: { receiptNumber: { startsWith: prefix } },
    orderBy: { receiptNumber: "desc" },
    select: { receiptNumber: true },
  });
  const seq = last ? parseInt(last.receiptNumber.slice(prefix.length), 10) + 1 : 1;
  return `${prefix}${String(seq).padStart(4, "0")}`;
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
  return Math.round(amount * 0.24 * (daysOverdue / 365) * 100) / 100;
}

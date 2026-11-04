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
 * Was this payment taken before the month it covers had started?
 *
 * The Advance Pay flow raises a bill for each future month and records the
 * payment on the day the money is taken, so an advance payment always lands in
 * an earlier month than its billing period. A bill for a month that had already
 * begun is an ordinary payment, not an advance.
 *
 * Billing periods are stored at 00:00 UTC while dates are shown in IST, so the
 * payment date is shifted to IST before its month is read. Otherwise a payment
 * made just after midnight IST on the 1st would read as the previous month.
 */
export function isAdvancePayment(paymentDate: Date, billingPeriodStart: Date): boolean {
  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
  const shifted = new Date(paymentDate.getTime() + IST_OFFSET_MS);
  const paymentMonthStart = Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), 1);
  return billingPeriodStart.getTime() > paymentMonthStart;
}

export interface AdvancePaymentRecord {
  id: string;
  connectionId: string;
  /** When the bill was raised — the day the advance money was taken. */
  billDate: Date;
  billingPeriodStart: Date;
  billingPeriodEnd: Date;
}

/** Is `next` the month immediately after `prev`? Periods always start on the 1st. */
function isNextBillingMonth(prev: Date, next: Date): boolean {
  const expected = Date.UTC(prev.getUTCFullYear(), prev.getUTCMonth() + 1, 1);
  return next.getTime() === expected;
}

/**
 * Group advance payments into the batches they were taken in.
 *
 * The Advance Pay flow bills several months at once, all sharing one bill date,
 * so a batch is a run of consecutive months paid together on the same day for
 * the same flat. Two separate advances on the same day stay apart unless their
 * months happen to be contiguous — in which case they really are one run.
 */
export function groupAdvancePaymentRuns<T extends AdvancePaymentRecord>(rows: T[]): T[][] {
  const byBatch = new Map<string, T[]>();
  for (const row of rows) {
    const key = `${row.connectionId}|${row.billDate.getTime()}`;
    const list = byBatch.get(key);
    if (list) list.push(row);
    else byBatch.set(key, [row]);
  }

  const runs: T[][] = [];
  for (const list of byBatch.values()) {
    list.sort((a, b) => a.billingPeriodStart.getTime() - b.billingPeriodStart.getTime());
    let run: T[] = [];
    for (const row of list) {
      const prev = run[run.length - 1];
      if (prev && !isNextBillingMonth(prev.billingPeriodStart, row.billingPeriodStart)) {
        runs.push(run);
        run = [];
      }
      run.push(row);
    }
    if (run.length > 0) runs.push(run);
  }
  return runs;
}

/** Days allowed to pay, counted from the end of the month being billed. */
const MAINTENANCE_DUE_DAYS = 15;

/**
 * Due date for a maintenance bill: 15 days after the end of the month it
 * bills, so August is due 15 September. Derived from the billing period, never
 * from the day the bill happened to be raised — otherwise one cycle ends up
 * with several different due dates.
 *
 * Built in UTC to match billingPeriodStart, and left at 00:00 so it renders as
 * that day in IST rather than rolling over to the next.
 */
export function maintenanceDueDate(billingPeriodStart: Date): Date {
  const year = billingPeriodStart.getUTCFullYear();
  const monthIndex = billingPeriodStart.getUTCMonth();
  // Day 0 of month+1 is the last day of the billing month; add the grace days.
  return new Date(Date.UTC(year, monthIndex + 1, MAINTENANCE_DUE_DAYS));
}

/**
 * The month a maintenance bill covers, as a [start, end] pair.
 *
 * Both ends sit at 00:00 UTC. The end used to be 23:59:59.999 UTC, which is
 * 05:29 the next morning in IST — so a bill for August rendered as
 * "01 Aug 2026 – 01 Sept 2026" everywhere it was formatted in local time.
 *
 * @param monthIndex 0-based, as in Date.getMonth().
 */
export function maintenanceBillingPeriod(year: number, monthIndex: number) {
  return {
    periodStart: new Date(Date.UTC(year, monthIndex, 1)),
    periodEnd: new Date(Date.UTC(year, monthIndex + 1, 0)),
  };
}

/**
 * Split a maintenance bill's stored amount into charge and GST.
 *
 * MaintenanceBill.amount is stored GST-INCLUSIVE — generation computes
 * base = round(unitArea x ratePerSqFt), adds CGST and SGST on that base, and
 * stores the total. Adding GST to `amount` again inflates the bill, which is
 * what the resident payment page and the bill email used to do.
 *
 * The charge is rebuilt from area x rate, the way generation did it. If that
 * does not reconcile with the stored total (an Advance Pay bill priced by hand,
 * or a rate changed since), the stored total is authoritative and gets split
 * back out of the inclusive figure instead.
 */
export function splitMaintenanceAmount(
  bill: {
    amount: number | string | { toString(): string };
    unitArea: number | string | { toString(): string };
    ratePerSqFt: number | string | { toString(): string };
  },
  cgstRate: number,
  sgstRate: number,
) {
  const total = Math.round(Number(bill.amount));
  const fromAreaBase = Math.round(Number(bill.unitArea) * Number(bill.ratePerSqFt));
  const cgstFromArea = Math.round(fromAreaBase * cgstRate / 100);
  const sgstFromArea = Math.round(fromAreaBase * sgstRate / 100);

  if (fromAreaBase + cgstFromArea + sgstFromArea === total) {
    return {
      base: fromAreaBase,
      cgst: cgstFromArea,
      sgst: sgstFromArea,
      totalGst: cgstFromArea + sgstFromArea,
      currentMonthTotal: total,
    };
  }

  // Back out the tax from a GST-inclusive figure.
  const combined = cgstRate + sgstRate;
  const cgst = combined > 0 ? Math.round(total * cgstRate / (100 + combined)) : 0;
  const sgst = combined > 0 ? Math.round(total * sgstRate / (100 + combined)) : 0;
  return { base: total - cgst - sgst, cgst, sgst, totalGst: cgst + sgst, currentMonthTotal: total };
}

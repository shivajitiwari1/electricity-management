import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { guardPermission } from "@/lib/permissions";
import { generateMaintenanceBillNumber, nextMaintenanceReceiptNumber, maintenanceDueDate, maintenanceBillingPeriod } from "@/lib/maintenance-billing";

const ALLOWED_METHODS = ["CASH", "UPI", "NEFT", "RTGS", "CHEQUE", "CREDIT_CARD", "ADJUSTMENT"] as const;
type ManualMethod = (typeof ALLOWED_METHODS)[number];

export async function POST(req: NextRequest) {
  const session = await auth();
  const guard = await guardPermission(session as any, "maintenance", "canWrite");
  if (guard) return guard;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const {
    connectionId,
    months: monthsParam,
    startMonth,
    amountPerMonth: amountParam,
    method: methodParam = "CASH",
    paymentDate: paymentDateParam,
    referenceId = null,
    rebateAmount: rebateParam,
  } = body as {
    connectionId?: string;
    months?: number;
    startMonth?: string;
    amountPerMonth?: number;
    method?: string;
    paymentDate?: string;
    referenceId?: string | null;
    rebateAmount?: number;
  };

  if (!connectionId || !startMonth || !amountParam || !monthsParam) {
    return NextResponse.json(
      { error: "connectionId, months, startMonth, amountPerMonth are required" },
      { status: 400 }
    );
  }

  if (![6, 12].includes(monthsParam)) {
    return NextResponse.json({ error: "months must be 6 or 12" }, { status: 400 });
  }

  const method = (ALLOWED_METHODS as readonly string[]).includes(methodParam ?? "")
    ? (methodParam as ManualMethod)
    : "CASH";

  const connection = await prisma.connection.findUnique({
    where: { id: connectionId },
    include: {
      resident: {
        include: { user: { select: { name: true } } },
      },
    },
  });
  if (!connection) {
    return NextResponse.json({ error: "Connection not found" }, { status: 404 });
  }

  const rate = await prisma.maintenanceRate.findFirst({
    orderBy: { effectiveFrom: "desc" },
  });
  if (!rate) {
    return NextResponse.json({ error: "No maintenance rate configured" }, { status: 422 });
  }

  const [startYear, startMon] = startMonth.split("-").map(Number);
  if (!startYear || !startMon || startMon < 1 || startMon > 12) {
    return NextResponse.json({ error: "Invalid startMonth. Use YYYY-MM" }, { status: 400 });
  }

  const siteConfig = await prisma.siteConfig.findUnique({ where: { id: "singleton" } });
  const cgstRate = Number(siteConfig?.cgstRate ?? 0);
  const sgstRate = Number(siteConfig?.sgstRate ?? 0);
  const baseAmount = Math.round(Number(amountParam));
  const cgst = Math.round(baseAmount * cgstRate / 100);
  const sgst = Math.round(baseAmount * sgstRate / 100);
  const totalAmount = baseAmount + cgst + sgst;

  const pDate = paymentDateParam ? new Date(paymentDateParam) : new Date();
  const receiptNumbers: string[] = [];
  let generated = 0;
  let skipped = 0;

  // Work out which months are actually going to be billed first: the rebate is
  // spread over the months that are really created, not the ones skipped
  // because a bill already exists for them.
  const monthsToCreate: {
    periodStart: Date;
    periodEnd: Date;
    dueDate: Date;
    billNumber: string;
  }[] = [];

  for (let n = 0; n < monthsParam; n++) {
    const month = ((startMon - 1 + n) % 12) + 1;
    const year = startYear + Math.floor((startMon - 1 + n) / 12);

    const { periodStart, periodEnd } = maintenanceBillingPeriod(year, month - 1);
    const dueDate = maintenanceDueDate(periodStart);
    const billNumber = generateMaintenanceBillNumber(connection.flatNo, periodStart);

    const existing = await prisma.maintenanceBill.findFirst({
      where: { connectionId, billingPeriodStart: periodStart },
      select: { id: true },
    });

    if (existing) {
      skipped++;
      continue;
    }

    monthsToCreate.push({ periodStart, periodEnd, dueDate, billNumber });
  }

  // A rebate / waiver is money the society gave up, so it must not be counted
  // as received. Each month keeps its full payable as paidAmount and gets an
  // ADJUSTMENT row for its share, exactly like a rebate on a normal payment.
  const rebateRequested = Math.max(0, Math.round(Number(rebateParam ?? 0)));
  const grossTotal = totalAmount * monthsToCreate.length;
  const rebateTotal = Math.min(rebateRequested, grossTotal);
  const rebateShares = monthsToCreate.map((_, i) => {
    if (rebateTotal <= 0) return 0;
    const share = Math.floor(rebateTotal / monthsToCreate.length);
    return i === monthsToCreate.length - 1
      ? rebateTotal - share * (monthsToCreate.length - 1)
      : share;
  });

  for (let i = 0; i < monthsToCreate.length; i++) {
    const { periodStart, periodEnd, dueDate, billNumber } = monthsToCreate[i];
    const rebateShare = rebateShares[i];
    const paidNow = totalAmount - rebateShare;

    const receiptNumber = await nextMaintenanceReceiptNumber(receiptNumbers);
    const rebateReceiptNumber =
      rebateShare > 0 ? await nextMaintenanceReceiptNumber([...receiptNumbers, receiptNumber]) : null;

    await prisma.$transaction(async (tx) => {
      const bill = await tx.maintenanceBill.create({
        data: {
          connectionId,
          maintenanceRateId: rate.id,
          billNumber,
          billDate: pDate,
          dueDate,
          billingPeriodStart: periodStart,
          billingPeriodEnd: periodEnd,
          unitArea: Number(connection.unitArea),
          ratePerSqFt: Number(rate.ratePerSqFt),
          amount: totalAmount,
          paidAmount: totalAmount,
          interestCharge: 0,
          status: "PAID",
        },
      });
      await tx.maintenancePayment.create({
        data: {
          maintenanceBillId: bill.id,
          amount: paidNow,
          paymentDate: pDate,
          method,
          status: "SUCCESS",
          receiptNumber,
          razorpayPaymentId: referenceId ?? (method === "CASH" ? "CASH" : null),
        },
      });
      if (rebateReceiptNumber) {
        await tx.maintenancePayment.create({
          data: {
            maintenanceBillId: bill.id,
            amount: rebateShare,
            paymentDate: pDate,
            method: "ADJUSTMENT",
            status: "SUCCESS",
            receiptNumber: rebateReceiptNumber,
            razorpayPaymentId: referenceId ? `Rebate: ${referenceId}` : "Rebate/Waiver",
          },
        });
      }
    });

    receiptNumbers.push(receiptNumber);
    if (rebateReceiptNumber) receiptNumbers.push(rebateReceiptNumber);
    generated++;
  }

  return NextResponse.json({ generated, skipped, receiptNumbers, rebate: rebateTotal });
}

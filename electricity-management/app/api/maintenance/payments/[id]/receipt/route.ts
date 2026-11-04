export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { generateReceiptPdf, ReceiptData } from "@/lib/pdf";
import {
  groupAdvancePaymentRuns,
  isAdvancePayment,
  splitMaintenanceAmount,
} from "@/lib/maintenance-billing";

/** DD-MM-YYYY, matching how lib/pdf.ts formats dates on the receipt. */
function periodDate(date: Date): string {
  const d = new Date(date);
  return `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()}`;
}

/** "Rs. 1,234.00" — matches formatCurrency() in lib/pdf.ts. */
function money(value: number): string {
  return `Rs. ${Number(value).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const payment = await prisma.maintenancePayment.findUnique({
    where: { id },
    include: {
      bill: {
        include: {
          connection: {
            include: {
              resident: {
                include: {
                  user: { select: { name: true, email: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!payment) {
    return NextResponse.json({ error: "Payment not found" }, { status: 404 });
  }

  // A rebate / waiver is not money received, so it gets no receipt of its own.
  // It is shown as a deduction on the receipt of the payment it was applied with.
  if (payment.method === "ADJUSTMENT") {
    return NextResponse.json(
      { error: "No receipt is issued for a rebate / waiver adjustment." },
      { status: 400 }
    );
  }

  const receiptData: ReceiptData = {
    receiptNumber: payment.receiptNumber,
    residentName: payment.bill.connection.resident?.user?.name ?? "Resident",
    flatNo: payment.bill.connection.flatNo,
    billNumber: payment.bill.billNumber,
    amount: Math.round(Number(payment.amount)),
    paymentDate: payment.paymentDate,
    razorpayPaymentId: payment.razorpayPaymentId ?? undefined,
    method: payment.method,
    title: "MAINTENANCE PAYMENT RECEIPT",
  };

  if (isAdvancePayment(payment.paymentDate, payment.bill.billingPeriodStart)) {
    // An advance is taken as one payment covering several months, but is stored
    // as one PAID bill and one receipt per month. Reprint it as a single receipt
    // for the whole batch so it states the amount and the duration that the
    // resident actually paid for.
    //
    // ADJUSTMENT rows are loaded too: they are the rebate / waiver given with
    // the advance and must appear in the receipt's breakdown, but they are not
    // payments, so they are left out of the batch grouping below.
    const siblings = await prisma.maintenancePayment.findMany({
      where: {
        status: "SUCCESS",
        bill: {
          connectionId: payment.bill.connectionId,
          billDate: payment.bill.billDate,
        },
      },
      select: {
        id: true,
        receiptNumber: true,
        amount: true,
        paymentDate: true,
        razorpayPaymentId: true,
        method: true,
        maintenanceBillId: true,
        bill: {
          select: {
            billNumber: true,
            billingPeriodStart: true,
            billingPeriodEnd: true,
            amount: true,
            unitArea: true,
            ratePerSqFt: true,
          },
        },
      },
    });

    const runs = groupAdvancePaymentRuns(
      siblings
        .filter((p) => p.method !== "ADJUSTMENT")
        .map((p) => ({
          id: p.id,
          connectionId: payment.bill.connectionId,
          billDate: payment.bill.billDate,
          billingPeriodStart: p.bill.billingPeriodStart,
          billingPeriodEnd: p.bill.billingPeriodEnd,
          receiptNumber: p.receiptNumber,
          amount: p.amount,
          paymentDate: p.paymentDate,
          razorpayPaymentId: p.razorpayPaymentId,
          method: p.method,
          billNumber: p.bill.billNumber,
          maintenanceBillId: p.maintenanceBillId,
          billAmount: p.bill.amount,
          unitArea: p.bill.unitArea,
          ratePerSqFt: p.bill.ratePerSqFt,
        }))
    );
    const batch = runs.find((run) => run.some((p) => p.id === payment.id)) ?? [];

    if (batch.length > 0) {
      const first = batch[0];
      const last = batch[batch.length - 1];
      const netTotal = batch.reduce((sum, p) => sum + Math.round(Number(p.amount)), 0);

      // The rebate is recorded as one ADJUSTMENT row per month, on the same
      // bills as the advance. Sum the ones belonging to this batch.
      const batchBillIds = new Set(batch.map((p) => p.maintenanceBillId));
      const rebateTotal = Math.round(
        siblings
          .filter((p) => p.method === "ADJUSTMENT" && batchBillIds.has(p.maintenanceBillId))
          .reduce((sum, p) => sum + Number(p.amount), 0)
      );

      // MaintenanceBill.amount is GST-inclusive, so split it — never add GST on
      // top. Summing per month also handles a batch whose months were priced
      // differently from each other.
      const siteConfig = await prisma.siteConfig.findUnique({
        where: { id: "singleton" },
        select: { cgstRate: true, sgstRate: true },
      });
      const cgstRate = Number(siteConfig?.cgstRate ?? 0);
      const sgstRate = Number(siteConfig?.sgstRate ?? 0);

      let baseTotal = 0;
      let cgstTotal = 0;
      let sgstTotal = 0;
      let grossTotal = 0;
      for (const p of batch) {
        const split = splitMaintenanceAmount(
          { amount: p.billAmount, unitArea: p.unitArea, ratePerSqFt: p.ratePerSqFt },
          cgstRate,
          sgstRate
        );
        baseTotal += split.base;
        cgstTotal += split.cgst;
        sgstTotal += split.sgst;
        grossTotal += split.currentMonthTotal;
      }

      // Legacy advances were sometimes recorded as a lump-sum payment on a
      // single monthly bill (e.g. 12 months paid against a one-month bill), so
      // the bills do not add up to the money received. Treat the excess as more
      // gross charged and back the GST out of it, so the breakdown always
      // reconciles: base + CGST + SGST = total = net + rebate.
      const unexplained = netTotal + rebateTotal - grossTotal;
      if (unexplained > 0) {
        const combined = cgstRate + sgstRate;
        const extraCgst = combined > 0 ? Math.round((unexplained * cgstRate) / (100 + combined)) : 0;
        const extraSgst = combined > 0 ? Math.round((unexplained * sgstRate) / (100 + combined)) : 0;
        baseTotal += unexplained - extraCgst - extraSgst;
        cgstTotal += extraCgst;
        sgstTotal += extraSgst;
        grossTotal += unexplained;
      }

      const breakdownRows: [string, string][] = [
        ["Base Maintenance Charges", money(baseTotal)],
      ];
      if (cgstTotal > 0) breakdownRows.push([`CGST @ ${cgstRate}%`, money(cgstTotal)]);
      if (sgstTotal > 0) breakdownRows.push([`SGST @ ${sgstRate}%`, money(sgstTotal)]);

      // Month-wise itemisation for the receipt. Every figure is derived from
      // the recorded bills, payments and rebates.
      const rebateByBill = new Map<string, number>();
      for (const s of siblings) {
        if (s.method === "ADJUSTMENT" && batchBillIds.has(s.maintenanceBillId)) {
          rebateByBill.set(
            s.maintenanceBillId,
            (rebateByBill.get(s.maintenanceBillId) ?? 0) + Number(s.amount)
          );
        }
      }
      receiptData.monthsTable = batch.map((p) => {
        const split = splitMaintenanceAmount(
          { amount: p.billAmount, unitArea: p.unitArea, ratePerSqFt: p.ratePerSqFt },
          cgstRate,
          sgstRate
        );
        const rebate = Math.round(rebateByBill.get(p.maintenanceBillId) ?? 0);
        return {
          period: new Date(p.billingPeriodStart).toLocaleString("en-IN", {
            month: "short",
            year: "numeric",
          }),
          billNumber: p.billNumber,
          base: split.base,
          cgst: split.cgst,
          sgst: split.sgst,
          gross: split.currentMonthTotal,
          rebate,
          net: Math.round(Number(p.amount)),
        };
      });
      breakdownRows.push(["Total (incl. GST)", money(grossTotal)]);
      if (rebateTotal > 0) {
        breakdownRows.push(["Rebate / Waiver", `- ${money(rebateTotal)}`]);
      }
      breakdownRows.push(["Net Amount Received", money(netTotal)]);

      receiptData.receiptNumber = first.receiptNumber;
      receiptData.billNumber =
        batch.length > 1 ? `${first.billNumber} to ${last.billNumber}` : first.billNumber;
      receiptData.amount = netTotal;
      receiptData.rebateAmount = rebateTotal > 0 ? rebateTotal : undefined;
      receiptData.method = first.method;
      receiptData.paymentDate = first.paymentDate;
      receiptData.razorpayPaymentId = first.razorpayPaymentId ?? undefined;
      receiptData.title = "ADVANCE MAINTENANCE PAYMENT RECEIPT";
      receiptData.monthsCovered = batch.length;
      receiptData.periodLabel = `${periodDate(first.billingPeriodStart)} to ${periodDate(last.billingPeriodEnd)}`;
      receiptData.breakdownRows = breakdownRows;
      receiptData.billTotal = grossTotal;
      receiptData.balanceDue = 0;
    }
  } else {
    // All SUCCESS payments on this bill, so we can state the balance as it stood
    // at the moment of this payment rather than as it stands today. A receipt is a
    // historical document: a reprint must not change because later payments landed.
    const allPayments = await prisma.maintenancePayment.findMany({
      where: { maintenanceBillId: payment.maintenanceBillId, status: "SUCCESS" },
      select: { id: true, amount: true, paymentDate: true, createdAt: true, method: true },
    });

    // The rebate row is written in the same transaction as its payment, so it
    // shares a paymentDate and lands within the same second.
    const rebatePayments = allPayments.filter(
      (p) =>
        p.method === "ADJUSTMENT" &&
        p.id !== payment.id &&
        Math.abs(p.createdAt.getTime() - payment.createdAt.getTime()) <= 5000
    );
    const rebateAmount = rebatePayments.reduce((sum, p) => sum + Number(p.amount), 0);
    const rebateIds = new Set(rebatePayments.map((p) => p.id));

    const isUpToThisPayment = (p: (typeof allPayments)[number]) =>
      p.paymentDate.getTime() < payment.paymentDate.getTime() ||
      (p.paymentDate.getTime() === payment.paymentDate.getTime() &&
        p.createdAt.getTime() <= payment.createdAt.getTime());

    const billTotal = Math.round(
      Number(payment.bill.amount) +
        Number(payment.bill.previousDue) +
        Number(payment.bill.interestCharge)
    );
    // This payment and its rebate are settled by this receipt, so count them
    // explicitly. The rebate row is inserted microseconds after the payment,
    // which is why a plain isUpToThisPayment filter drops it and makes the
    // receipt claim the waived amount is still outstanding.
    const paidSoFar =
      allPayments
        .filter((p) => p.id !== payment.id && !rebateIds.has(p.id) && isUpToThisPayment(p))
        .reduce((sum, p) => sum + Number(p.amount), 0) +
      Number(payment.amount) +
      rebateAmount;
    const balanceDue = Math.max(0, Math.round(billTotal - paidSoFar));

    receiptData.rebateAmount = rebateAmount > 0 ? Math.round(rebateAmount) : undefined;
    receiptData.billTotal = billTotal;
    receiptData.balanceDue = balanceDue;
  }

  const buffer = await generateReceiptPdf(receiptData);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="receipt-${receiptData.receiptNumber}.pdf"`,
    },
  });
}

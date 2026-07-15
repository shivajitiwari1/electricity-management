import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calculateBill, generateBillNumber } from "@/lib/billing";
import { sendEmail } from "@/lib/email";
import { billGeneratedEmail } from "@/lib/email-templates";
import { Decimal } from "@prisma/client/runtime/client";

export async function GET(req: NextRequest) {
  // Cron secret check — no JWT auth
  const cronSecret = req.headers.get("x-cron-secret");
  if (!cronSecret || cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Determine current billing period (current calendar month)
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  // Fetch the latest rate
  const rate = await prisma.rate.findFirst({
    orderBy: { effectiveFrom: "desc" },
  });

  if (!rate) {
    return NextResponse.json(
      { success: false, error: "No rate configuration found" },
      { status: 422 }
    );
  }

  // Fetch all ACTIVE connections with their residents
  const connections = await prisma.connection.findMany({
    where: { status: "ACTIVE" },
    include: {
      resident: {
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      },
    },
  });

  let generated = 0;
  let skipped = 0;
  let errors = 0;

  for (const connection of connections) {
    try {
      // Check if a bill already exists for this billing period
      const existingBill = await prisma.bill.findFirst({
        where: {
          connectionId: connection.id,
          billingPeriodStart: {
            gte: periodStart,
            lt: new Date(now.getFullYear(), now.getMonth() + 1, 1),
          },
        },
      });

      if (existingBill) {
        skipped++;
        continue;
      }

      // Find a meter reading for this period that has no bill yet
      const meterReading = await prisma.meterReading.findFirst({
        where: {
          connectionId: connection.id,
          readingDate: { gte: periodStart, lte: periodEnd },
          bill: null, // no bill linked yet
        },
        orderBy: { readingDate: "desc" },
      });

      if (!meterReading) {
        // No reading available for this period — cannot generate bill
        skipped++;
        continue;
      }

      const billDate = now;
      const prevDues = new Decimal(0);

      const calculation = calculateBill({
        ncplUnits: meterReading.ncplUnits,
        ratePerUnit: rate.ncplPerUnit,
        dgCharge: rate.dgFixed,
        fixedPerKw: rate.fixedPerKw,
        sanctionedLoad: connection.sanctionedLoad,
        previousDues: prevDues,
        billDate,
      });

      const billNumber = generateBillNumber(connection.flatNo, billDate);

      const bill = await prisma.bill.create({
        data: {
          connectionId: connection.id,
          meterReadingId: meterReading.id,
          billNumber,
          billDate,
          dueDate: calculation.dueDate,
          billingPeriodStart: periodStart,
          billingPeriodEnd: periodEnd,
          ncplUnits: meterReading.ncplUnits,
          ratePerUnit: rate.ncplPerUnit,
          ncplCharge: calculation.ncplCharge,
          dgCharge: calculation.dgCharge,
          fixedCharge: calculation.fixedCharge,
          previousDues: prevDues,
          totalAmount: calculation.totalAmount,
          status: "PENDING",
        },
      });

      // Send email — best effort, don't fail the loop
      try {
        const residentEmail = connection.resident.user.email;
        const residentName = connection.resident.user.name ?? "Resident";
        const payUrl = `${process.env.NEXTAUTH_URL}/resident/bills/${bill.id}/pay`;

        const html = billGeneratedEmail({
          residentName,
          flatNo: connection.flatNo,
          billNumber: bill.billNumber,
          billingPeriod: `${periodStart.toISOString().slice(0, 10)} to ${periodEnd.toISOString().slice(0, 10)}`,
          totalAmount: calculation.totalAmount.toFixed(2),
          dueDate: calculation.dueDate.toDateString(),
          payUrl,
        });

        await sendEmail(residentEmail, `Electricity Bill - ${bill.billNumber}`, html);
      } catch (emailErr) {
        console.error(`[cron:generate-bills] Email failed for ${connection.flatNo}:`, emailErr);
      }

      generated++;
    } catch (err) {
      console.error(`[cron:generate-bills] Error for connection ${connection.id}:`, err);
      errors++;
    }
  }

  return NextResponse.json({ success: true, generated, skipped, errors });
}

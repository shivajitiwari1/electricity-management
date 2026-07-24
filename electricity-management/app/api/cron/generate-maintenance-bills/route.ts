import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { generateMaintenanceBillNumber, isLastDayOfMonth } from "@/lib/maintenance-billing";
import { sendEmail } from "@/lib/email";
import { maintenanceBillGeneratedEmail } from "@/lib/email-templates";

export async function GET(req: NextRequest) {
  // Accept cron secret OR admin session
  const cronSecret = req.headers.get("x-cron-secret");
  const isValidCron = cronSecret && cronSecret === process.env.CRON_SECRET;

  const session = await auth();
  const isAdmin = (session?.user as any)?.role === "ADMIN";

  if (!isValidCron && !isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();

  // When triggered by cron (not admin), only run on last day of month
  if (isValidCron && !isAdmin && !isLastDayOfMonth(now)) {
    return NextResponse.json({ skipped: "not last day of month" });
  }

  // Parse optional ?month=YYYY-MM override (admin only)
  const { searchParams } = new URL(req.url);
  const monthParam = searchParams.get("month");

  let periodStart: Date;
  let periodEnd: Date;

  if (monthParam) {
    const [year, mon] = monthParam.split("-").map(Number);
    if (!year || !mon || mon < 1 || mon > 12) {
      return NextResponse.json({ error: "Invalid month format. Use YYYY-MM" }, { status: 400 });
    }
    periodStart = new Date(Date.UTC(year, mon - 1, 1));
    periodEnd = new Date(Date.UTC(year, mon, 0, 23, 59, 59, 999));
  } else {
    periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999));
  }

  const rate = await prisma.maintenanceRate.findFirst({
    where: { effectiveFrom: { lte: now } },
    orderBy: { effectiveFrom: "desc" },
  });

  if (!rate) {
    return NextResponse.json({ success: false, error: "No maintenance rate configured" }, { status: 422 });
  }

  const connections = await prisma.connection.findMany({
    where: { status: "ACTIVE" },
    include: {
      resident: {
        include: { user: { select: { name: true, email: true } } },
      },
    },
  });

  let created = 0;
  let skipped = 0;
  let errors = 0;

  for (const connection of connections) {
    try {
      if (!connection.unitArea || connection.unitArea === 0) {
        console.warn(`[cron:maintenance] Skipping ${connection.flatNo}: unitArea is 0`);
        skipped++;
        continue;
      }

      const billNumber = generateMaintenanceBillNumber(connection.flatNo, periodStart);

      const existing = await prisma.maintenanceBill.findUnique({ where: { billNumber } });
      if (existing) { skipped++; continue; }

      const dueDate = new Date(now);
      dueDate.setDate(dueDate.getDate() + 15);

      const amount = Number(connection.unitArea) * Number(rate.ratePerSqFt);

      const bill = await prisma.maintenanceBill.create({
        data: {
          connectionId: connection.id,
          maintenanceRateId: rate.id,
          billNumber,
          billDate: now,
          dueDate,
          billingPeriodStart: periodStart,
          billingPeriodEnd: periodEnd,
          unitArea: connection.unitArea,
          ratePerSqFt: rate.ratePerSqFt,
          amount,
          paidAmount: 0,
          interestCharge: 0,
          status: "PENDING",
        },
      });

      try {
        const billingPeriodStr = `${periodStart.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })} – ${periodEnd.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}`;
        const html = maintenanceBillGeneratedEmail({
          residentName: connection.resident.user.name ?? "Resident",
          flatNo: connection.flatNo,
          billNumber: bill.billNumber,
          billingPeriod: billingPeriodStr,
          unitArea: connection.unitArea,
          ratePerSqFt: Number(rate.ratePerSqFt).toFixed(2),
          amount: amount.toFixed(2),
          dueDate: dueDate.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
        });
        await sendEmail(
          connection.resident.user.email,
          `Maintenance Bill — ${periodStart.toLocaleString("en-IN", { month: "long", year: "numeric" })} — ${connection.flatNo}`,
          html
        );
      } catch (emailErr) {
        console.error(`[cron:maintenance] Email failed for ${connection.flatNo}:`, emailErr);
      }

      created++;
    } catch (err) {
      console.error(`[cron:maintenance] Error for connection ${connection.id}:`, err);
      errors++;
    }
  }

  return NextResponse.json({ success: true, created, skipped, errors });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const isAdmin = (session?.user as any)?.role === "ADMIN";
  if (!isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const now = new Date();

  // Parse optional ?month=YYYY-MM override
  const { searchParams } = new URL(req.url);
  const monthParam = searchParams.get("month");

  let periodStart: Date;
  let periodEnd: Date;

  if (monthParam) {
    const [year, mon] = monthParam.split("-").map(Number);
    if (!year || !mon || mon < 1 || mon > 12) {
      return NextResponse.json({ error: "Invalid month format. Use YYYY-MM" }, { status: 400 });
    }
    periodStart = new Date(Date.UTC(year, mon - 1, 1));
    periodEnd = new Date(Date.UTC(year, mon, 0, 23, 59, 59, 999));
  } else {
    periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999));
  }

  const rate = await prisma.maintenanceRate.findFirst({
    where: { effectiveFrom: { lte: now } },
    orderBy: { effectiveFrom: "desc" },
  });

  if (!rate) {
    return NextResponse.json({ success: false, error: "No maintenance rate configured" }, { status: 422 });
  }

  const connections = await prisma.connection.findMany({
    where: { status: "ACTIVE" },
    include: {
      resident: {
        include: { user: { select: { name: true, email: true } } },
      },
    },
  });

  let created = 0;
  let skipped = 0;
  let errors = 0;

  for (const connection of connections) {
    try {
      if (!connection.unitArea || connection.unitArea === 0) {
        console.warn(`[admin:maintenance] Skipping ${connection.flatNo}: unitArea is 0`);
        skipped++;
        continue;
      }

      const billNumber = generateMaintenanceBillNumber(connection.flatNo, periodStart);

      const existing = await prisma.maintenanceBill.findUnique({ where: { billNumber } });
      if (existing) { skipped++; continue; }

      const dueDate = new Date(now);
      dueDate.setDate(dueDate.getDate() + 15);

      const amount = Number(connection.unitArea) * Number(rate.ratePerSqFt);

      const bill = await prisma.maintenanceBill.create({
        data: {
          connectionId: connection.id,
          maintenanceRateId: rate.id,
          billNumber,
          billDate: now,
          dueDate,
          billingPeriodStart: periodStart,
          billingPeriodEnd: periodEnd,
          unitArea: connection.unitArea,
          ratePerSqFt: rate.ratePerSqFt,
          amount,
          paidAmount: 0,
          interestCharge: 0,
          status: "PENDING",
        },
      });

      try {
        const billingPeriodStr = `${periodStart.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })} – ${periodEnd.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}`;
        const html = maintenanceBillGeneratedEmail({
          residentName: connection.resident.user.name ?? "Resident",
          flatNo: connection.flatNo,
          billNumber: bill.billNumber,
          billingPeriod: billingPeriodStr,
          unitArea: connection.unitArea,
          ratePerSqFt: Number(rate.ratePerSqFt).toFixed(2),
          amount: amount.toFixed(2),
          dueDate: dueDate.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
        });
        await sendEmail(
          connection.resident.user.email,
          `Maintenance Bill — ${periodStart.toLocaleString("en-IN", { month: "long", year: "numeric" })} — ${connection.flatNo}`,
          html
        );
      } catch (emailErr) {
        console.error(`[admin:maintenance] Email failed for ${connection.flatNo}:`, emailErr);
      }

      created++;
    } catch (err) {
      console.error(`[admin:maintenance] Error for connection ${connection.id}:`, err);
      errors++;
    }
  }

  return NextResponse.json({ success: true, created, skipped, errors });
}

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { generateMaintenanceBillNumber, isLastDayOfMonth, maintenanceDueDate } from "@/lib/maintenance-billing";
import { sendEmail } from "@/lib/email";
import { maintenanceBillGeneratedEmail } from "@/lib/email-templates";
import { generateUpiQrDataUrl } from "@/lib/qr";

type ConnectionRow = Awaited<ReturnType<typeof fetchConnections>>[number];

async function fetchConnections() {
  return prisma.connection.findMany({
    where: { status: "ACTIVE" },
    include: { resident: { include: { user: { select: { name: true, email: true } } } } },
  });
}

async function createBillsBatch(
  connections: ConnectionRow[],
  rate: { id: string; ratePerSqFt: number | string | { toString(): string } },
  periodStart: Date,
  periodEnd: Date,
  now: Date,
) {
  const valid = connections.filter(c => c.unitArea && Number(c.unitArea) !== 0);

  // Check all existing bills for this period in ONE query
  const allBillNumbers = valid.map(c => generateMaintenanceBillNumber(c.flatNo, periodStart));
  const existing = await prisma.maintenanceBill.findMany({
    where: { billNumber: { in: allBillNumbers } },
    select: { billNumber: true },
  });
  const existingSet = new Set(existing.map(b => b.billNumber));

  const toCreate = valid.filter(c => !existingSet.has(generateMaintenanceBillNumber(c.flatNo, periodStart)));
  const skipped = connections.length - toCreate.length;

  if (toCreate.length === 0) return { created: 0, skipped, toCreate: [], billIdByNumber: new Map<string, string>() };

  const dueDate = maintenanceDueDate(periodStart);

  // Create all bills in ONE batch query
  await prisma.maintenanceBill.createMany({
    data: toCreate.map(c => ({
      connectionId: c.id,
      maintenanceRateId: rate.id,
      billNumber: generateMaintenanceBillNumber(c.flatNo, periodStart),
      billDate: now,
      dueDate,
      billingPeriodStart: periodStart,
      billingPeriodEnd: periodEnd,
      unitArea: Number(c.unitArea),
      ratePerSqFt: Number(rate.ratePerSqFt),
      amount: Math.round(Number(c.unitArea) * Number(rate.ratePerSqFt)),
      paidAmount: 0,
      interestCharge: 0,
      status: "PENDING" as const,
    })),
  });

  // createMany returns no ids, so read them back to build a per-bill pay link.
  const created = await prisma.maintenanceBill.findMany({
    where: { billNumber: { in: toCreate.map(c => generateMaintenanceBillNumber(c.flatNo, periodStart)) } },
    select: { id: true, billNumber: true },
  });
  const billIdByNumber = new Map(created.map(b => [b.billNumber, b.id]));

  return { created: toCreate.length, skipped, toCreate, dueDate, billIdByNumber };
}

function sendBillEmails(
  toCreate: ConnectionRow[],
  rate: { ratePerSqFt: number | string | { toString(): string } },
  periodStart: Date,
  periodEnd: Date,
  dueDate: Date,
  logPrefix: string,
  cgstRate: number,
  sgstRate: number,
  billIdByNumber: Map<string, string>,
) {
  const billingPeriodStr = `${periodStart.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })} – ${periodEnd.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}`;
  const subject = `Maintenance Bill — ${periodStart.toLocaleString("en-IN", { month: "long", year: "numeric" })}`;
  const fmt = (n: number) => String(Math.round(n));

  return Promise.allSettled(
    toCreate.map(async (c) => {
      const baseAmount = Math.round(Number(c.unitArea) * Number(rate.ratePerSqFt));
      const cgst = Math.round(baseAmount * cgstRate / 100);
      const sgst = Math.round(baseAmount * sgstRate / 100);
      const currentMonthTotal = baseAmount + cgst + sgst;
      const billNumber = generateMaintenanceBillNumber(c.flatNo, periodStart);
      const billId = billIdByNumber.get(billNumber);
      try {
        const html = maintenanceBillGeneratedEmail({
          residentName: c.resident.user.name ?? "Resident",
          flatNo: c.flatNo,
          billNumber,
          billingPeriod: billingPeriodStr,
          unitArea: Number(c.unitArea),
          ratePerSqFt: Number(rate.ratePerSqFt).toFixed(2),
          amount: fmt(baseAmount),
          cgstRate: fmt(cgstRate),
          sgstRate: fmt(sgstRate),
          cgst: fmt(cgst),
          sgst: fmt(sgst),
          currentMonthTotal: fmt(currentMonthTotal),
          previousDue: "0.00",
          interestCharge: "0.00",
          netPayable: fmt(currentMonthTotal),
          dueDate: dueDate.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
          payUrl: billId ? `${process.env.NEXTAUTH_URL}/resident/maintenance/${billId}/pay` : undefined,
          hasQrAttachment: true,
        });
        const qrDataUrl = await generateUpiQrDataUrl(currentMonthTotal);
        await sendEmail(c.resident.user.email, `${subject} — ${c.flatNo}`, html, [
          {
            filename: "qr.png",
            content: Buffer.from(qrDataUrl.replace(/^data:image\/png;base64,/, ""), "base64"),
            contentType: "image/png",
            cid: "upi-qr",
          },
        ]);
      } catch (err) {
        console.error(`[${logPrefix}] Email failed for ${c.flatNo}:`, err);
      }
    })
  );
}

export async function GET(req: NextRequest) {
  const cronSecret = req.headers.get("x-cron-secret");
  const isValidCron = cronSecret && cronSecret === process.env.CRON_SECRET;

  const session = await auth();
  const isAdmin = (session?.user as any)?.role === "ADMIN";

  if (!isValidCron && !isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const siteConfig = await prisma.siteConfig.findUnique({ where: { id: "singleton" } });
  if (!siteConfig?.maintenanceBillingEnabled) {
    return NextResponse.json({ error: "Maintenance billing is currently disabled" }, { status: 422 });
  }

  const now = new Date();

  if (isValidCron && !isAdmin && !isLastDayOfMonth(now)) {
    return NextResponse.json({ skipped: "not last day of month" });
  }

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

  if (!rate) return NextResponse.json({ success: false, error: "No maintenance rate configured" }, { status: 422 });

  const connections = await fetchConnections();
  const result = await createBillsBatch(connections, rate, periodStart, periodEnd, now);

  if (result.toCreate.length > 0) {
    await sendBillEmails(result.toCreate, rate, periodStart, periodEnd, result.dueDate!, "cron:maintenance", Number(siteConfig.cgstRate ?? 0), Number(siteConfig.sgstRate ?? 0), result.billIdByNumber);
  }

  return NextResponse.json({ success: true, created: result.created, skipped: result.skipped });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const isAdmin = (session?.user as any)?.role === "ADMIN";
  if (!isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const siteConfig = await prisma.siteConfig.findUnique({ where: { id: "singleton" } });
  if (!siteConfig?.maintenanceBillingEnabled) {
    return NextResponse.json({ error: "Maintenance billing is currently disabled" }, { status: 422 });
  }

  const now = new Date();

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

  if (!rate) return NextResponse.json({ success: false, error: "No maintenance rate configured" }, { status: 422 });

  const connections = await fetchConnections();
  const result = await createBillsBatch(connections, rate, periodStart, periodEnd, now);

  if (result.toCreate.length > 0) {
    await sendBillEmails(result.toCreate, rate, periodStart, periodEnd, result.dueDate!, "admin:maintenance", Number(siteConfig.cgstRate ?? 0), Number(siteConfig.sgstRate ?? 0), result.billIdByNumber);
  }

  return NextResponse.json({ success: true, created: result.created, skipped: result.skipped });
}

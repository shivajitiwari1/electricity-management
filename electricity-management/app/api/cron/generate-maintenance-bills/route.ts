import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { generateMaintenanceBillNumber, isLastDayOfMonth } from "@/lib/maintenance-billing";
import { sendEmail } from "@/lib/email";
import { maintenanceBillGeneratedEmail } from "@/lib/email-templates";

type ConnectionRow = Awaited<ReturnType<typeof fetchConnections>>[number];

async function fetchConnections() {
  return prisma.connection.findMany({
    where: { status: "ACTIVE" },
    include: { resident: { include: { user: { select: { name: true, email: true } } } } },
  });
}

async function createBillsBatch(
  connections: ConnectionRow[],
  rate: { id: string; ratePerSqFt: { toString(): string } },
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

  if (toCreate.length === 0) return { created: 0, skipped, toCreate: [] };

  const dueDate = new Date(now);
  dueDate.setDate(dueDate.getDate() + 15);

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
      unitArea: c.unitArea,
      ratePerSqFt: rate.ratePerSqFt,
      amount: Number(c.unitArea) * Number(rate.ratePerSqFt),
      paidAmount: 0,
      interestCharge: 0,
      status: "PENDING" as const,
    })),
  });

  return { created: toCreate.length, skipped, toCreate, dueDate };
}

function sendBillEmails(
  toCreate: ConnectionRow[],
  rate: { ratePerSqFt: { toString(): string } },
  periodStart: Date,
  periodEnd: Date,
  dueDate: Date,
  logPrefix: string,
) {
  const billingPeriodStr = `${periodStart.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })} – ${periodEnd.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}`;
  const subject = `Maintenance Bill — ${periodStart.toLocaleString("en-IN", { month: "long", year: "numeric" })}`;

  return Promise.allSettled(
    toCreate.map(async (c) => {
      const amount = Number(c.unitArea) * Number(rate.ratePerSqFt);
      const billNumber = generateMaintenanceBillNumber(c.flatNo, periodStart);
      try {
        const html = maintenanceBillGeneratedEmail({
          residentName: c.resident.user.name ?? "Resident",
          flatNo: c.flatNo,
          billNumber,
          billingPeriod: billingPeriodStr,
          unitArea: Number(c.unitArea),
          ratePerSqFt: Number(rate.ratePerSqFt).toFixed(2),
          amount: amount.toFixed(2),
          dueDate: dueDate.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
        });
        await sendEmail(c.resident.user.email, `${subject} — ${c.flatNo}`, html);
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
    await sendBillEmails(result.toCreate, rate, periodStart, periodEnd, result.dueDate!, "cron:maintenance");
  }

  return NextResponse.json({ success: true, created: result.created, skipped: result.skipped });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const isAdmin = (session?.user as any)?.role === "ADMIN";
  if (!isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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

  // Fire emails concurrently and don't await — bills are created, respond fast
  if (result.toCreate.length > 0) {
    sendBillEmails(result.toCreate, rate, periodStart, periodEnd, result.dueDate!, "admin:maintenance").catch(() => {});
  }

  return NextResponse.json({ success: true, created: result.created, skipped: result.skipped });
}

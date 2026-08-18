import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { generateMaintenanceBillNumber } from "@/lib/maintenance-billing";
import { sendEmail } from "@/lib/email";
import { maintenanceBillGeneratedEmail } from "@/lib/email-templates";

export async function POST(req: NextRequest) {
  const session = await auth();
  const isAdmin = (session?.user as any)?.role === "ADMIN";
  if (!isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const siteConfig = await prisma.siteConfig.findUnique({ where: { id: "singleton" } });
  if (!siteConfig?.maintenanceBillingEnabled) {
    return NextResponse.json({ error: "Maintenance billing is currently disabled" }, { status: 422 });
  }

  const { connectionId, month, previousDue } = await req.json();

  if (!connectionId || !month) {
    return NextResponse.json({ error: "connectionId and month required" }, { status: 400 });
  }

  const [year, mon] = (month as string).split("-").map(Number);
  if (!year || !mon || mon < 1 || mon > 12) {
    return NextResponse.json({ error: "Invalid month format. Use YYYY-MM" }, { status: 400 });
  }

  const periodStart = new Date(Date.UTC(year, mon - 1, 1));
  const periodEnd = new Date(Date.UTC(year, mon, 0, 23, 59, 59, 999));

  const connection = await prisma.connection.findUnique({
    where: { id: connectionId },
    include: { resident: { include: { user: { select: { name: true, email: true } } } } },
  });

  if (!connection) return NextResponse.json({ error: "Connection not found" }, { status: 404 });
  if (connection.status !== "ACTIVE") {
    return NextResponse.json({ error: "Connection is not active" }, { status: 422 });
  }

  const billNumber = generateMaintenanceBillNumber(connection.flatNo, periodStart);

  const existing = await prisma.maintenanceBill.findFirst({
    where: { billNumber },
    select: { id: true, billNumber: true },
  });

  if (existing) {
    return NextResponse.json({ skipped: true, billNumber: existing.billNumber });
  }

  const rate = await prisma.maintenanceRate.findFirst({
    where: { effectiveFrom: { lte: new Date() } },
    orderBy: { effectiveFrom: "desc" },
  });

  if (!rate) {
    return NextResponse.json({ error: "No maintenance rate configured" }, { status: 422 });
  }

  const cgstRate = Number(siteConfig.cgstRate ?? 0);
  const sgstRate = Number(siteConfig.sgstRate ?? 0);
  const baseAmount = Math.round(Number(connection.unitArea) * Number(rate.ratePerSqFt));
  const cgst = Math.round(baseAmount * cgstRate / 100);
  const sgst = Math.round(baseAmount * sgstRate / 100);
  const totalAmount = baseAmount + cgst + sgst;

  const now = new Date();
  const dueDate = new Date(now);
  dueDate.setDate(dueDate.getDate() + 15);

  const bill = await prisma.maintenanceBill.create({
    data: {
      connectionId: connection.id,
      maintenanceRateId: rate.id,
      billNumber,
      billDate: now,
      dueDate,
      billingPeriodStart: periodStart,
      billingPeriodEnd: periodEnd,
      unitArea: Number(connection.unitArea),
      ratePerSqFt: Number(rate.ratePerSqFt),
      amount: totalAmount,
      previousDue: previousDue ? Number(previousDue) : 0,
      paidAmount: 0,
      interestCharge: 0,
      status: "PENDING",
    },
  });

  const prevDueNum = previousDue ? Math.round(Number(previousDue)) : 0;
  const netPayable = totalAmount + prevDueNum;
  const fmt = (n: number) => String(Math.round(n));

  const billingPeriodStr = `${periodStart.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })} – ${periodEnd.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}`;
  try {
    await sendEmail(
      connection.resident.user.email,
      `Maintenance Bill — ${periodStart.toLocaleString("en-IN", { month: "long", year: "numeric" })} — ${connection.flatNo}`,
      maintenanceBillGeneratedEmail({
        residentName: connection.resident.user.name ?? "Resident",
        flatNo: connection.flatNo,
        billNumber,
        billingPeriod: billingPeriodStr,
        unitArea: Number(connection.unitArea),
        ratePerSqFt: Number(rate.ratePerSqFt).toFixed(2),
        amount: fmt(baseAmount),
        cgstRate: fmt(cgstRate),
        sgstRate: fmt(sgstRate),
        cgst: fmt(cgst),
        sgst: fmt(sgst),
        currentMonthTotal: fmt(totalAmount),
        previousDue: fmt(prevDueNum),
        interestCharge: "0.00",
        netPayable: fmt(netPayable),
        dueDate: dueDate.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
      })
    );
  } catch {
    // email failure must not fail bill creation
  }

  return NextResponse.json({ created: true, billNumber: bill.billNumber });
}

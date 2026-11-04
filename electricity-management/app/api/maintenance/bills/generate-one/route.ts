import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { generateMaintenanceBillNumber, maintenanceDueDate, maintenanceBillingPeriod } from "@/lib/maintenance-billing";
import { sendEmail } from "@/lib/email";
import { maintenanceBillGeneratedEmail } from "@/lib/email-templates";
import { generateUpiQrDataUrl } from "@/lib/qr";

export async function POST(req: NextRequest) {
  const session = await auth();
  const isAdmin = (session?.user as any)?.role === "ADMIN";
  if (!isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const siteConfig = await prisma.siteConfig.findUnique({ where: { id: "singleton" } });
  if (!siteConfig?.maintenanceBillingEnabled) {
    return NextResponse.json({ error: "Maintenance billing is currently disabled" }, { status: 422 });
  }

  const { connectionId, month, previousDue, billDate: billDateParam } = await req.json();

  if (!connectionId) {
    return NextResponse.json({ error: "connectionId required" }, { status: 400 });
  }

  // A date picked in the generate-bill form is the bill issue date, stored
  // at UTC midnight like billing periods so it renders as that day in IST.
  let billDate: Date = new Date();
  let periodFromDate: { year: number; monthIndex: number } | null = null;
  if (billDateParam != null) {
    if (typeof billDateParam !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(billDateParam)) {
      return NextResponse.json({ error: "Invalid bill date. Use YYYY-MM-DD" }, { status: 400 });
    }
    const parsed = new Date(`${billDateParam}T00:00:00.000Z`);
    if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== billDateParam) {
      return NextResponse.json({ error: "Invalid bill date. Use YYYY-MM-DD" }, { status: 400 });
    }
    billDate = parsed;
    periodFromDate = { year: parsed.getUTCFullYear(), monthIndex: parsed.getUTCMonth() };
  }

  let periodStart: Date;
  let periodEnd: Date;
  if (month != null && month !== "") {
    const [year, mon] = String(month).split("-").map(Number);
    if (!year || !mon || mon < 1 || mon > 12) {
      return NextResponse.json({ error: "Invalid month format. Use YYYY-MM" }, { status: 400 });
    }
    if (
      periodFromDate &&
      (year !== periodFromDate.year || mon - 1 !== periodFromDate.monthIndex)
    ) {
      return NextResponse.json(
        { error: "billDate and month refer to different months. Pick one or make them agree." },
        { status: 400 }
      );
    }
    ({ periodStart, periodEnd } = maintenanceBillingPeriod(year, mon - 1));
  } else if (periodFromDate) {
    ({ periodStart, periodEnd } = maintenanceBillingPeriod(
      periodFromDate.year,
      periodFromDate.monthIndex
    ));
  } else {
    return NextResponse.json({ error: "billDate (or month) required" }, { status: 400 });
  }

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

  // The rate in effect on the selected issue date — important when back-dating a bill.
  const rate = await prisma.maintenanceRate.findFirst({
    where: { effectiveFrom: { lte: billDate } },
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

  const dueDate = maintenanceDueDate(periodStart);

  const bill = await prisma.maintenanceBill.create({
    data: {
      connectionId: connection.id,
      maintenanceRateId: rate.id,
      billNumber,
      billDate,
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
        payUrl: `${process.env.NEXTAUTH_URL}/resident/maintenance/${bill.id}/pay`,
        hasQrAttachment: true,
      }),
      [
        {
          filename: "qr.png",
          content: Buffer.from(
            (await generateUpiQrDataUrl(netPayable)).replace(/^data:image\/png;base64,/, ""),
            "base64"
          ),
          contentType: "image/png",
          cid: "upi-qr",
        },
      ]
    );
  } catch {
    // email failure must not fail bill creation
  }

  return NextResponse.json({ created: true, billNumber: bill.billNumber });
}

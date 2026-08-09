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

  const { connectionId, month } = await req.json();

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
      amount: Number(connection.unitArea) * Number(rate.ratePerSqFt),
      paidAmount: 0,
      interestCharge: 0,
      status: "PENDING",
    },
  });

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
        amount: (Number(connection.unitArea) * Number(rate.ratePerSqFt)).toFixed(2),
        dueDate: dueDate.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
      })
    );
  } catch {
    // email failure must not fail bill creation
  }

  return NextResponse.json({ created: true, billNumber: bill.billNumber });
}

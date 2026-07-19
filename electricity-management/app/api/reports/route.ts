import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session || (session.user.role !== "ADMIN" && session.user.role !== "MANAGER")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");

  if (type === "monthly-revenue") {
    return NextResponse.json({ monthlyRevenue: await getMonthlyRevenue() });
  }

  if (type === "overdue") {
    return NextResponse.json({ overdueBills: await getOverdueBills() });
  }

  if (type === "consumption") {
    return NextResponse.json({ consumption: await getConsumption() });
  }

  // No type param — return all three
  const [monthlyRevenue, overdueBills, consumption] = await Promise.all([
    getMonthlyRevenue(),
    getOverdueBills(),
    getConsumption(),
  ]);

  return NextResponse.json({ monthlyRevenue, overdueBills, consumption });
}

// ─── Monthly Revenue ────────────────────────────────────────────────────────

async function getMonthlyRevenue() {
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
  twelveMonthsAgo.setDate(1);
  twelveMonthsAgo.setHours(0, 0, 0, 0);

  const paidBills = await prisma.bill.findMany({
    where: {
      status: "PAID",
      billDate: { gte: twelveMonthsAgo },
    },
    select: {
      billDate: true,
      totalAmount: true,
      connection: { select: { tower: true } },
    },
  });

  // Aggregate in JS: group by "YYYY-MM" + tower
  const map = new Map<string, { revenue: number; billCount: number }>();

  for (const bill of paidBills) {
    const year = bill.billDate.getFullYear();
    const month = String(bill.billDate.getMonth() + 1).padStart(2, "0");
    const key = `${year}-${month}::${bill.connection.tower}`;

    const existing = map.get(key) ?? { revenue: 0, billCount: 0 };
    existing.revenue += bill.totalAmount.toNumber();
    existing.billCount += 1;
    map.set(key, existing);
  }

  const result: Array<{
    month: string;
    tower: string;
    revenue: number;
    billCount: number;
  }> = [];

  for (const [key, agg] of map.entries()) {
    const [month, tower] = key.split("::");
    result.push({ month, tower, revenue: agg.revenue, billCount: agg.billCount });
  }

  // Sort chronologically then by tower
  result.sort((a, b) =>
    a.month !== b.month ? a.month.localeCompare(b.month) : a.tower.localeCompare(b.tower)
  );

  return result;
}

// ─── Overdue Bills ───────────────────────────────────────────────────────────

async function getOverdueBills() {
  return prisma.bill.findMany({
    where: { status: "OVERDUE" },
    include: {
      connection: {
        include: {
          resident: {
            include: {
              user: { select: { id: true, name: true, email: true } },
            },
          },
        },
      },
    },
    orderBy: { dueDate: "asc" },
  });
}

// ─── Consumption ─────────────────────────────────────────────────────────────

async function getConsumption() {
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
  threeMonthsAgo.setDate(1);
  threeMonthsAgo.setHours(0, 0, 0, 0);

  const readings = await prisma.meterReading.findMany({
    where: { readingDate: { gte: threeMonthsAgo } },
    select: {
      connectionId: true,
      readingDate: true,
      ncplUnits: true,
      connection: {
        select: {
          flatNo: true,
          tower: true,
        },
      },
    },
    orderBy: { readingDate: "asc" },
  });

  return readings.map((r) => ({
    connectionId: r.connectionId,
    flatNo: r.connection.flatNo,
    tower: r.connection.tower,
    readingDate: r.readingDate,
    ncplUnits: r.ncplUnits.toNumber(),
  }));
}

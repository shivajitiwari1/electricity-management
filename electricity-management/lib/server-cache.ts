import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";

// Admin dashboard stats — refresh every 60 s
export const getCachedDashboardStats = unstable_cache(
  async () => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const [totalResidents, activeConnections, billsThisMonth, revenueThisMonth, overdueBills] =
      await Promise.all([
        prisma.resident.count(),
        prisma.connection.count({ where: { status: "ACTIVE" } }),
        prisma.bill.count({ where: { billDate: { gte: monthStart } } }),
        prisma.bill.aggregate({ where: { status: "PAID", billDate: { gte: monthStart } }, _sum: { totalAmount: true } }),
        prisma.bill.count({ where: { status: "OVERDUE" } }),
      ]);
    return { totalResidents, activeConnections, billsThisMonth, revenueThisMonth, overdueBills };
  },
  ["admin-dashboard-stats"],
  { revalidate: 60, tags: ["dashboard"] }
);

// Recent bills for dashboard — refresh every 60 s
export const getCachedRecentBills = unstable_cache(
  async () =>
    prisma.bill.findMany({
      take: 10,
      orderBy: { createdAt: "desc" },
      include: { connection: { include: { resident: { include: { user: true } } } } },
    }),
  ["admin-recent-bills"],
  { revalidate: 60, tags: ["bills"] }
);

// Residents list — refresh every 60 s
export const getCachedResidents = unstable_cache(
  async () =>
    prisma.resident.findMany({
      include: {
        user: { select: { id: true, name: true, email: true } },
        connections: {
          select: {
            id: true, flatNo: true, tower: true, floor: true,
            unitType: true, unitArea: true, meterNo: true,
            sanctionedLoad: true, status: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
  ["admin-residents"],
  { revalidate: 60, tags: ["residents"] }
);

// Connections list — refresh every 60 s
export const getCachedConnections = unstable_cache(
  async () =>
    prisma.connection.findMany({
      include: { resident: { include: { user: { select: { name: true, email: true } } } } },
      orderBy: { tower: "asc" },
    }),
  ["admin-connections"],
  { revalidate: 60, tags: ["connections"] }
);

// Flat info — refresh every hour (rarely changes)
export const getCachedFlats = unstable_cache(
  async () =>
    prisma.flatInfo.findMany({ orderBy: [{ tower: "asc" }, { flatNo: "asc" }] }),
  ["admin-flats"],
  { revalidate: 3600, tags: ["flats"] }
);

// Rates — refresh every hour
export const getCachedRates = unstable_cache(
  async () => prisma.rate.findMany({ orderBy: { effectiveFrom: "desc" } }),
  ["admin-rates"],
  { revalidate: 3600, tags: ["rates"] }
);

// Meter readings page data — refresh every 30 s
export const getCachedMeterReadingsData = unstable_cache(
  async () => {
    const [connections, currentRate] = await Promise.all([
      prisma.connection.findMany({
        where: { status: "ACTIVE" },
        include: {
          resident: { include: { user: { select: { name: true } } } },
          meterReadings: {
            orderBy: { readingDate: "desc" },
            take: 1,
            include: { bill: { select: { id: true } } },
          },
        },
        orderBy: { flatNo: "asc" },
      }),
      prisma.rate.findFirst({ orderBy: { effectiveFrom: "desc" } }),
    ]);
    return { connections, currentRate };
  },
  ["admin-meter-readings"],
  { revalidate: 30, tags: ["meter-readings"] }
);

// Payments page data — refresh every 30 s
export const getCachedPaymentsData = unstable_cache(
  async () => {
    const [payments, pendingBills] = await Promise.all([
      prisma.payment.findMany({
        include: {
          bill: { include: { connection: { include: { resident: { include: { user: { select: { name: true } } } } } } } },
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      prisma.bill.findMany({
        where: { status: { in: ["PENDING", "OVERDUE", "PARTIAL"] } },
        include: { connection: { include: { resident: { include: { user: { select: { name: true } } } } } } },
        orderBy: [{ status: "asc" }, { dueDate: "asc" }],
      }),
    ]);
    return { payments, pendingBills };
  },
  ["admin-payments"],
  { revalidate: 30, tags: ["payments"] }
);

// Reports data — refresh every 5 min (heavy query)
export const getCachedReportsData = unstable_cache(
  async () => {
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    const [paidBills, overdueBills, allBills, totalRevenue, totalBills, totalResidents] =
      await Promise.all([
        prisma.bill.findMany({
          where: { status: "PAID", billDate: { gte: twelveMonthsAgo } },
          select: { billDate: true, totalAmount: true, ncplUnits: true, connection: { select: { tower: true, flatNo: true } } },
        }),
        prisma.bill.findMany({
          where: { status: "OVERDUE" },
          select: {
            id: true, billNumber: true, dueDate: true, totalAmount: true,
            connection: { include: { resident: { include: { user: { select: { name: true } } } } } },
          },
          orderBy: { dueDate: "asc" },
        }),
        prisma.bill.findMany({
          select: {
            id: true, billNumber: true, billDate: true, dueDate: true, totalAmount: true, status: true,
            connection: { select: { flatNo: true, tower: true, resident: { include: { user: { select: { name: true } } } } } },
          },
          orderBy: { billDate: "desc" },
          take: 500,
        }),
        prisma.bill.aggregate({ where: { status: "PAID" }, _sum: { totalAmount: true } }),
        prisma.bill.count(),
        prisma.resident.count(),
      ]);

    return { paidBills, overdueBills, allBills, totalRevenue, totalBills, totalResidents };
  },
  ["admin-reports"],
  { revalidate: 300, tags: ["reports"] }
);

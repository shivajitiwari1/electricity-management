export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import ReportsClient from "@/components/admin/reports-client";

export default async function ReportsPage() {
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

  // Monthly revenue by tower (last 12 months) - paid bills only
  const paidBills = await prisma.bill.findMany({
    where: {
      status: "PAID",
      billDate: { gte: twelveMonthsAgo },
    },
    select: {
      billDate: true,
      totalAmount: true,
      ncplUnits: true,
      connection: { select: { tower: true, flatNo: true } },
    },
  });

  // Overdue bills
  const overdueBills = await prisma.bill.findMany({
    where: { status: "OVERDUE" },
    select: {
      id: true,
      billNumber: true,
      dueDate: true,
      totalAmount: true,
      connection: {
        include: {
          resident: { include: { user: { select: { name: true } } } },
        },
      },
    },
    orderBy: { dueDate: "asc" },
  });

  // All bills for CSV export (recent 500)
  const allBills = await prisma.bill.findMany({
    select: {
      id: true,
      billNumber: true,
      billDate: true,
      dueDate: true,
      totalAmount: true,
      status: true,
      connection: {
        select: {
          flatNo: true,
          tower: true,
          resident: { include: { user: { select: { name: true } } } },
        },
      },
    },
    orderBy: { billDate: "desc" },
    take: 500,
  });

  // Total stats
  const [totalRevenue, totalBills, totalResidents] = await Promise.all([
    prisma.bill.aggregate({
      where: { status: "PAID" },
      _sum: { totalAmount: true },
    }),
    prisma.bill.count(),
    prisma.resident.count(),
  ]);

  // Serialize paid bills
  const serializedPaidBills = paidBills.map((b) => ({
    billDate: b.billDate.toISOString(),
    totalAmount: Number(b.totalAmount),
    ncplUnits: Number(b.ncplUnits),
    tower: b.connection.tower,
    flatNo: b.connection.flatNo,
  }));

  // Serialize overdue bills
  const serializedOverdue = overdueBills.map((b) => ({
    id: b.id,
    billNumber: b.billNumber,
    flatNo: b.connection.flatNo,
    tower: b.connection.tower,
    residentName: b.connection.resident.user.name,
    dueDate: b.dueDate.toISOString(),
    totalAmount: Number(b.totalAmount),
  }));

  // Serialize all bills for CSV export
  const serializedAllBills = allBills.map((b) => ({
    id: b.id,
    billNumber: b.billNumber,
    flatNo: b.connection.flatNo,
    tower: b.connection.tower,
    residentName: b.connection.resident.user.name,
    billDate: b.billDate.toISOString(),
    dueDate: b.dueDate.toISOString(),
    totalAmount: Number(b.totalAmount),
    status: b.status,
  }));

  const stats = {
    totalRevenue: Number(totalRevenue._sum.totalAmount ?? 0),
    totalBills,
    totalResidents,
    overdueCount: overdueBills.length,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
        <p className="text-sm text-gray-500 mt-1">
          Financial reports and analytics for Oasis Venetia Heights
        </p>
      </div>
      <ReportsClient
        paidBills={serializedPaidBills}
        overdueBills={serializedOverdue}
        allBills={serializedAllBills}
        stats={stats}
      />
    </div>
  );
}

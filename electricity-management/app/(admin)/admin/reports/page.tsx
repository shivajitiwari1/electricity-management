import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import ReportsClient from "@/components/admin/reports-client";
import { StatCardsSkeleton, TableSkeleton } from "@/components/ui/page-skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export const revalidate = 300; // reports are heavy — refresh every 5 min

async function ReportsData() {
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

  const stats = {
    totalRevenue: Number(totalRevenue._sum.totalAmount ?? 0),
    totalBills,
    totalResidents,
    overdueCount: overdueBills.length,
  };

  return (
    <ReportsClient
      paidBills={paidBills.map((b) => ({ billDate: b.billDate.toISOString(), totalAmount: Number(b.totalAmount), ncplUnits: Number(b.ncplUnits), tower: b.connection.tower, flatNo: b.connection.flatNo }))}
      overdueBills={overdueBills.map((b) => ({ id: b.id, billNumber: b.billNumber, flatNo: b.connection.flatNo, tower: b.connection.tower, residentName: b.connection.resident.user.name, dueDate: b.dueDate.toISOString(), totalAmount: Number(b.totalAmount) }))}
      allBills={allBills.map((b) => ({ id: b.id, billNumber: b.billNumber, flatNo: b.connection.flatNo, tower: b.connection.tower, residentName: b.connection.resident.user.name, billDate: b.billDate.toISOString(), dueDate: b.dueDate.toISOString(), totalAmount: Number(b.totalAmount), status: b.status }))}
      stats={stats}
    />
  );
}

function ReportsLoadingSkeleton() {
  return (
    <div className="space-y-6">
      <StatCardsSkeleton count={4} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[0, 1, 2, 3].map((i) => (
          <Card key={i}>
            <CardHeader><Skeleton className="h-5 w-40" /></CardHeader>
            <CardContent><Skeleton className="h-48 w-full rounded-md" /></CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
        <p className="text-sm text-gray-500 mt-1">
          Financial reports and analytics for Oasis Venetia Heights
        </p>
      </div>
      <Suspense fallback={<ReportsLoadingSkeleton />}>
        <ReportsData />
      </Suspense>
    </div>
  );
}

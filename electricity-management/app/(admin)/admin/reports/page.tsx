import { Suspense } from "react";
import ReportsClient from "@/components/admin/reports-client";
import { StatCardsSkeleton } from "@/components/ui/page-skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getCachedReportsData } from "@/lib/server-cache";

export const dynamic = "force-dynamic";

async function ReportsData() {
  const { paidBills, overdueBills, allBills, totalRevenue, totalBills, totalResidents } =
    await getCachedReportsData();

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

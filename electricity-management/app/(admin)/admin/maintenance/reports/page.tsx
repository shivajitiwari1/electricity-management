import { Suspense } from "react";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import MaintenanceReportsClient from "@/components/admin/maintenance-reports-client";
import { StatCardsSkeleton } from "@/components/ui/page-skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getCachedMaintenanceReportsData, getCachedSiteConfig } from "@/lib/server-cache";
import type { PermissionsMap } from "@/lib/permissions";

export const dynamic = "force-dynamic";

async function MaintenanceReportsData() {
  const { paidPayments, overdueBills, allBills, totalRevenue, totalBills, totalResidents } =
    await getCachedMaintenanceReportsData();

  const stats = {
    totalRevenue: Number(totalRevenue._sum.amount ?? 0),
    totalBills,
    totalResidents,
    overdueCount: overdueBills.length,
  };

  return (
    <MaintenanceReportsClient
      paidPayments={paidPayments.map((p) => ({
        paymentDate: new Date(p.paymentDate).toISOString(),
        amount: Number(p.amount),
        tower: p.bill.connection.tower,
        flatNo: p.bill.connection.flatNo,
      }))}
      overdueBills={overdueBills.map((b) => ({
        id: b.id,
        billNumber: b.billNumber,
        flatNo: b.connection.flatNo,
        tower: b.connection.tower,
        residentName: b.connection.resident?.user?.name ?? "—",
        dueDate: new Date(b.dueDate).toISOString(),
        outstandingAmount: b.outstandingAmount,
        status: b.status,
      }))}
      allBills={allBills.map((b) => ({
        id: b.id,
        billNumber: b.billNumber,
        flatNo: b.connection.flatNo,
        tower: b.connection.tower,
        residentName: b.connection.resident?.user?.name ?? "—",
        billDate: new Date(b.billDate).toISOString(),
        dueDate: new Date(b.dueDate).toISOString(),
        amount: Number(b.amount),
        outstandingAmount: Math.max(
          0,
          Math.round(
            Number(b.amount) + Number(b.previousDue) + Number(b.interestCharge) - Number(b.paidAmount)
          )
        ),
        status: b.status,
      }))}
      stats={stats}
    />
  );
}

function MaintenanceReportsLoadingSkeleton() {
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

export default async function MaintenanceReportsPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const role = (session.user as any)?.role as string;
  const permissions = (session.user as any)?.permissions as PermissionsMap ?? {};
  if (role !== "ADMIN" && !permissions["maintenance"]?.canRead) redirect("/admin/dashboard");

  const siteConfig = await getCachedSiteConfig();
  if (!siteConfig.maintenanceBillingEnabled) redirect("/admin/maintenance");

  return (
    <main className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Maintenance Reports</h1>
        <p className="text-sm text-gray-500 mt-1">
          Maintenance revenue, bills and overdue analytics
        </p>
      </div>
      <Suspense fallback={<MaintenanceReportsLoadingSkeleton />}>
        <MaintenanceReportsData />
      </Suspense>
    </main>
  );
}

import { Suspense } from "react";
import { auth } from "@/auth";
import type { PermissionsMap } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import MaintenanceBillsTable from "@/components/admin/maintenance-bills-table";
import { TableSkeleton } from "@/components/ui/page-skeleton";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

async function BillsData() {
  const session = await auth();
  const role = (session?.user as any)?.role as string;
  const permissions = (session?.user as any)?.permissions as PermissionsMap ?? {};
  const canWrite = role === "ADMIN" || permissions["maintenance"]?.canWrite === true;

  const bills = await prisma.maintenanceBill.findMany({
    include: {
      connection: {
        include: {
          resident: { include: { user: { select: { name: true } } } },
        },
      },
    },
    orderBy: { billDate: "desc" },
    take: 200,
  });

  const serialized = bills.map((b) => ({
    id: b.id,
    billNumber: b.billNumber,
    flatNo: b.connection.flatNo,
    tower: b.connection.tower,
    residentName: b.connection.resident.user.name ?? "—",
    unitArea: b.connection.unitArea,
    amount: b.amount.toString(),
    paidAmount: b.paidAmount.toString(),
    interestCharge: b.interestCharge.toString(),
    dueDate: b.dueDate.toISOString(),
    billDate: b.billDate.toISOString(),
    billingPeriodStart: b.billingPeriodStart.toISOString(),
    billingPeriodEnd: b.billingPeriodEnd.toISOString(),
    ratePerSqFt: b.ratePerSqFt.toString(),
    status: b.status,
  }));

  return <MaintenanceBillsTable initialData={serialized} canWrite={canWrite} />;
}

export default function MaintenanceBillsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Maintenance Bills</h1>
          <p className="text-sm text-gray-500 mt-1">Monthly maintenance charges · 24% p.a. interest on overdue</p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/maintenance/rates"><Button variant="outline">Manage Rates</Button></Link>
          <Link href="/admin/maintenance/generate"><Button>Scheduler</Button></Link>
        </div>
      </div>
      <Suspense fallback={<TableSkeleton rows={8} cols={7} />}>
        <BillsData />
      </Suspense>
    </div>
  );
}

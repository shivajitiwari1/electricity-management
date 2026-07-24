import { auth } from "@/auth";
import type { PermissionsMap } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import MaintenanceRatesManager from "@/components/admin/maintenance-rates-manager";
import Link from "next/link";
import { ChevronLeft, CalendarRange } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function MaintenanceRatesPage() {
  const session = await auth();
  const role = (session?.user as any)?.role as string;
  const permissions = (session?.user as any)?.permissions as PermissionsMap ?? {};
  const canWrite = role === "ADMIN" || permissions["maintenance"]?.canWrite === true;

  if (!canWrite) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Maintenance Rates</h1>
        <p className="text-gray-500">You do not have permission to manage rates.</p>
      </div>
    );
  }

  const rates = await prisma.maintenanceRate.findMany({ orderBy: { effectiveFrom: "desc" } });

  const serialized = rates.map((r) => ({
    id: r.id,
    ratePerSqFt: r.ratePerSqFt.toString(),
    effectiveFrom: r.effectiveFrom.toISOString(),
    createdAt: r.createdAt.toISOString(),
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/admin/maintenance" className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">
              <ChevronLeft className="h-3.5 w-3.5" />Maintenance Bills
            </Link>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Maintenance Rates</h1>
          <p className="text-sm text-gray-500 mt-1">Configure the monthly maintenance charge rate per sq ft</p>
        </div>
        <Link
          href="/admin/maintenance/generate"
          className="flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-800 border border-blue-200 rounded-lg px-3 py-1.5 hover:bg-blue-50 transition-colors"
        >
          <CalendarRange className="h-4 w-4" />Bill Scheduler
        </Link>
      </div>
      <MaintenanceRatesManager rates={serialized} />
    </div>
  );
}

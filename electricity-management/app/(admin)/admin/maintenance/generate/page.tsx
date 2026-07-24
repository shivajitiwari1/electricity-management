import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import MaintenanceGenerator from "@/components/admin/maintenance-generator";
import Link from "next/link";
import { ChevronLeft, Settings2 } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function MaintenanceGeneratePage() {
  const session = await auth();
  const role = (session?.user as any)?.role as string;
  if (role !== "ADMIN") redirect("/admin/maintenance");

  const [currentRate, connections] = await Promise.all([
    prisma.maintenanceRate.findFirst({
      where: { effectiveFrom: { lte: new Date() } },
      orderBy: { effectiveFrom: "desc" },
    }),
    prisma.connection.findMany({
      where: { status: "ACTIVE" },
      include: {
        resident: { include: { user: { select: { name: true } } } },
      },
      orderBy: { flatNo: "asc" },
    }),
  ]);

  const connectionPreviews = connections.map((c) => ({
    flatNo: c.flatNo,
    residentName: c.resident.user.name ?? "—",
    unitArea: c.unitArea,
    projectedAmount: currentRate
      ? (c.unitArea * Number(currentRate.ratePerSqFt)).toFixed(2)
      : "0",
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
          <h1 className="text-2xl font-bold text-gray-900">Maintenance Bill Scheduler</h1>
          <p className="text-sm text-gray-500 mt-1">
            Raise monthly maintenance bills for all active connections. Bills are also auto-generated on the last day of each month.
          </p>
        </div>
        <Link
          href="/admin/maintenance/rates"
          className="flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-800 border border-blue-200 rounded-lg px-3 py-1.5 hover:bg-blue-50 transition-colors"
        >
          <Settings2 className="h-4 w-4" />Manage Rates
        </Link>
      </div>
      <MaintenanceGenerator
        currentRatePerSqFt={currentRate ? currentRate.ratePerSqFt.toString() : null}
        connections={connectionPreviews}
      />
    </div>
  );
}

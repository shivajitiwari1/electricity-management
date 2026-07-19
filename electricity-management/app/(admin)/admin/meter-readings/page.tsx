import { Suspense } from "react";
import { auth } from "@/auth";
import type { PermissionsMap } from "@/lib/permissions";
import MeterReadingsTable from "@/components/admin/meter-readings-table";
import { TableSkeleton } from "@/components/ui/page-skeleton";
import { getCachedMeterReadingsData } from "@/lib/server-cache";

export const dynamic = "force-dynamic";

async function MeterReadingsData() {
  const session = await auth();
  const role = (session?.user as any)?.role as string;
  const permissions = (session?.user as any)?.permissions as PermissionsMap ?? {};
  const canWrite = role === "ADMIN" || permissions["meter-readings"]?.canWrite === true;
  const canDelete = role === "ADMIN" || permissions["meter-readings"]?.canDelete === true;

  const { connections, currentRate, latestByConnection, billedReadingIds } = await getCachedMeterReadingsData();
  const billedSet = new Set(billedReadingIds);

  // For the "Add Reading" dropdown — all connections with last reading for auto-fill
  const serializedConnections = connections.map((c) => ({
    id: c.id,
    flatNo: c.flatNo,
    residentName: c.resident.user.name,
    lastNcplReading: latestByConnection[c.id]?.ncplCurrent?.toString() ?? "0",
    lastDgReading: "0",
  }));

  // One row per flat showing the latest reading (all flats, including those with no reading)
  const serializedReadings = connections.map((c) => {
    const r = latestByConnection[c.id] ?? null;
    return {
      id: r?.id ?? "",
      flatNo: c.flatNo,
      residentName: c.resident.user.name,
      readingDate: r?.readingDate?.toString() ?? "",
      ncplPrevious: r?.ncplPrevious?.toString() ?? "",
      ncplCurrent: r?.ncplCurrent?.toString() ?? "",
      ncplUnits: r?.ncplUnits?.toString() ?? "",
      dgUnits: r?.dgUnits?.toString() ?? "",
      connectionId: c.id,
      hasBill: r ? billedSet.has(r.id) : false,
      hasReading: !!r,
    };
  });

  return (
    <MeterReadingsTable
      connections={serializedConnections}
      readings={serializedReadings}
      dgFixed={currentRate ? Number(currentRate.dgFixed) : 0}
      canWrite={canWrite}
      canDelete={canDelete}
    />
  );
}

export default function MeterReadingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Meter Readings</h1>
        <p className="text-sm text-gray-500 mt-1">
          Record and manage electricity meter readings
        </p>
      </div>
      <Suspense fallback={<TableSkeleton rows={10} cols={6} showSearch showFilters filterCount={2} />}>
        <MeterReadingsData />
      </Suspense>
    </div>
  );
}

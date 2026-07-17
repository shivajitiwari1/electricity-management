import { Suspense } from "react";
import MeterReadingsTable from "@/components/admin/meter-readings-table";
import { TableSkeleton } from "@/components/ui/page-skeleton";
import { getCachedMeterReadingsData } from "@/lib/server-cache";

export const dynamic = "force-dynamic";

async function MeterReadingsData() {
  const { connections, currentRate, readings } = await getCachedMeterReadingsData();

  const serializedConnections = connections.map((c) => ({
    id: c.id,
    flatNo: c.flatNo,
    residentName: c.resident.user.name,
    lastNcplReading: c.meterReadings[0]?.ncplCurrent?.toString() ?? "0",
    lastDgReading: c.meterReadings[0]?.dgCurrent?.toString() ?? "0",
  }));

  const serializedReadings = readings.map((r) => ({
    id: r.id,
    flatNo: r.connection.flatNo,
    residentName: r.connection.resident.user.name,
    readingDate: r.readingDate.toISOString(),
    ncplPrevious: r.ncplPrevious.toString(),
    ncplCurrent: r.ncplCurrent.toString(),
    ncplUnits: r.ncplUnits.toString(),
    dgUnits: r.dgUnits.toString(),
    connectionId: r.connectionId,
    hasBill: !!r.bill,
  }));

  return (
    <MeterReadingsTable
      connections={serializedConnections}
      readings={serializedReadings}
      dgFixed={currentRate ? Number(currentRate.dgFixed) : 0}
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

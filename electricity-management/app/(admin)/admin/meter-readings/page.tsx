export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import MeterReadingsTable from "@/components/admin/meter-readings-table";

export default async function MeterReadingsPage() {
  const connections = await prisma.connection.findMany({
    where: { status: "ACTIVE" },
    include: {
      resident: { include: { user: { select: { name: true } } } },
      meterReadings: {
        orderBy: { readingDate: "desc" },
        take: 1,
      },
    },
    orderBy: { flatNo: "asc" },
  });

  const serializedConnections = connections.map((c) => ({
    id: c.id,
    flatNo: c.flatNo,
    residentName: c.resident.user.name,
    lastNcplReading: c.meterReadings[0]?.ncplCurrent?.toString() ?? "0",
    lastDgReading: c.meterReadings[0]?.dgCurrent?.toString() ?? "0",
  }));

  const currentRate = await prisma.rate.findFirst({
    orderBy: { effectiveFrom: "desc" },
  });

  const readings = await prisma.meterReading.findMany({
    include: {
      connection: {
        include: {
          resident: { include: { user: { select: { name: true } } } },
        },
      },
      bill: { select: { id: true } },
    },
    orderBy: { readingDate: "desc" },
    take: 50,
  });

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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Meter Readings</h1>
        <p className="text-sm text-gray-500 mt-1">
          Record and manage electricity meter readings
        </p>
      </div>
      <MeterReadingsTable
        connections={serializedConnections}
        readings={serializedReadings}
        dgFixed={currentRate ? Number(currentRate.dgFixed) : 0}
      />
    </div>
  );
}

import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import ResidentsTable from "@/components/admin/residents-table";
import { ALL_FLATS } from "@/lib/flat-data";
import { TableSkeleton } from "@/components/ui/page-skeleton";

export const revalidate = 60;

async function ResidentsData() {
  const residents = await prisma.resident.findMany({
    include: {
      user: { select: { id: true, name: true, email: true } },
      connections: {
        select: {
          id: true, flatNo: true, tower: true, floor: true,
          unitType: true, unitArea: true, meterNo: true,
          sanctionedLoad: true, status: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const serialized = residents.map((r) => ({
    ...r,
    connections: r.connections.map((c) => ({
      ...c,
      sanctionedLoad: c.sanctionedLoad.toString(),
      unitArea: c.unitArea?.toString() ?? null,
    })),
  }));

  return <ResidentsTable initialData={serialized} flatData={ALL_FLATS} />;
}

export default function ResidentsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Residents</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage residents of Oasis Venetia Heights
        </p>
      </div>
      <Suspense fallback={<TableSkeleton rows={10} cols={5} showSearch showFilters filterCount={1} />}>
        <ResidentsData />
      </Suspense>
    </div>
  );
}

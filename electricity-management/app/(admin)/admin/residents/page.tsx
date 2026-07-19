import { Suspense } from "react";
import { auth } from "@/auth";
import type { PermissionsMap } from "@/lib/permissions";
import ResidentsTable from "@/components/admin/residents-table";
import { ALL_FLATS } from "@/lib/flat-data";
import { TableSkeleton } from "@/components/ui/page-skeleton";
import { getCachedResidents } from "@/lib/server-cache";

export const dynamic = "force-dynamic";

async function ResidentsData() {
  const session = await auth();
  const role = (session?.user as any)?.role as string;
  const permissions = (session?.user as any)?.permissions as PermissionsMap ?? {};
  const canWrite = role === "ADMIN" || permissions["residents"]?.canWrite === true;
  const canDelete = role === "ADMIN" || permissions["residents"]?.canDelete === true;

  const residents = await getCachedResidents();

  const serialized = residents.map((r) => ({
    ...r,
    connections: r.connections.map((c) => ({
      ...c,
      sanctionedLoad: c.sanctionedLoad.toString(),
      unitArea: c.unitArea?.toString() ?? null,
    })),
  }));

  return <ResidentsTable initialData={serialized} flatData={ALL_FLATS} canWrite={canWrite} canDelete={canDelete} />;
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

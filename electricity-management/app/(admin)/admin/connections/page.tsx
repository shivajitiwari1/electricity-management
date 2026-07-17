import { Suspense } from "react";
import ConnectionsTable from "@/components/admin/connections-table";
import { TableSkeleton } from "@/components/ui/page-skeleton";
import { getCachedConnections } from "@/lib/server-cache";

export const dynamic = "force-dynamic";

async function ConnectionsData() {
  const raw = await getCachedConnections();
  const connections = JSON.parse(JSON.stringify(raw));
  return <ConnectionsTable initialData={connections} />;
}

export default function ConnectionsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Connections</h1>
        <p className="text-sm text-gray-500 mt-1">
          Manage electricity connections for all flats
        </p>
      </div>
      <Suspense fallback={<TableSkeleton rows={10} cols={6} showSearch showFilters filterCount={1} />}>
        <ConnectionsData />
      </Suspense>
    </div>
  );
}

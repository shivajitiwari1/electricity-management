import { Suspense } from "react";
import FlatInfoTable from "@/components/admin/flat-info-table";
import { TableSkeleton } from "@/components/ui/page-skeleton";
import { getCachedFlats } from "@/lib/server-cache";

export const dynamic = "force-dynamic";

async function FlatsData() {
  const flats = await getCachedFlats();
  return <FlatInfoTable initialData={flats} />;
}

export default function FlatsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Flat Info</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage flat master data for Oasis Venetia Heights
        </p>
      </div>
      <Suspense fallback={<TableSkeleton rows={12} cols={5} showSearch showFilters filterCount={1} />}>
        <FlatsData />
      </Suspense>
    </div>
  );
}

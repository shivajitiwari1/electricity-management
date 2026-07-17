import { TableSkeleton, PageHeadingSkeleton } from "@/components/ui/page-skeleton";

export default function ResidentsLoading() {
  return (
    <div className="space-y-6">
      <PageHeadingSkeleton />
      <TableSkeleton rows={10} cols={5} showSearch showFilters filterCount={1} />
    </div>
  );
}

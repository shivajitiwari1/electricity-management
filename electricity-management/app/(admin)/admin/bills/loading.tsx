import { TableSkeleton, PageHeadingSkeleton } from "@/components/ui/page-skeleton";

export default function BillsLoading() {
  return (
    <div className="space-y-6">
      <PageHeadingSkeleton />
      <TableSkeleton rows={10} cols={7} showSearch showFilters filterCount={3} />
    </div>
  );
}

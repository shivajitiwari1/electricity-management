import { PageHeadingSkeleton, TableSkeleton } from "@/components/ui/page-skeleton";

export default function ResidentBillsLoading() {
  return (
    <div className="space-y-6">
      <PageHeadingSkeleton />
      <TableSkeleton rows={8} cols={5} showSearch showFilters filterCount={1} />
    </div>
  );
}

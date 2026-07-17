import { PageHeadingSkeleton, StatCardsSkeleton, TableSkeleton } from "@/components/ui/page-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

export default function ResidentDashboardLoading() {
  return (
    <div className="space-y-6">
      <PageHeadingSkeleton />
      <StatCardsSkeleton count={3} />
      <div className="flex gap-3">
        <Skeleton className="h-9 w-28" />
        <Skeleton className="h-9 w-28" />
      </div>
      <TableSkeleton rows={5} cols={5} showSearch={false} />
    </div>
  );
}

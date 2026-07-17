import { StatCardsSkeleton, TableSkeleton, PageHeadingSkeleton } from "@/components/ui/page-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      <PageHeadingSkeleton />
      <StatCardsSkeleton count={5} />
      <div className="flex gap-3">
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-9 w-36" />
        <Skeleton className="h-9 w-28" />
      </div>
      <TableSkeleton rows={6} cols={6} showSearch={false} />
    </div>
  );
}

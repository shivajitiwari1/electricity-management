import { PageHeadingSkeleton } from "@/components/ui/page-skeleton";
import { TableSkeleton } from "@/components/ui/page-skeleton";

export default function RatesLoading() {
  return (
    <div className="space-y-6">
      <PageHeadingSkeleton />
      <TableSkeleton rows={4} cols={5} showSearch={false} />
    </div>
  );
}

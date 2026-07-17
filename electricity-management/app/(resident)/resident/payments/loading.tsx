import { PageHeadingSkeleton, TableSkeleton } from "@/components/ui/page-skeleton";

export default function ResidentPaymentsLoading() {
  return (
    <div className="space-y-6">
      <PageHeadingSkeleton />
      <TableSkeleton rows={8} cols={5} showSearch={false} />
    </div>
  );
}

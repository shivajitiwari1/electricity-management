import { PageHeadingSkeleton, FormCardSkeleton } from "@/components/ui/page-skeleton";

export default function ResidentProfileLoading() {
  return (
    <div className="space-y-6">
      <PageHeadingSkeleton />
      <FormCardSkeleton fields={4} />
    </div>
  );
}

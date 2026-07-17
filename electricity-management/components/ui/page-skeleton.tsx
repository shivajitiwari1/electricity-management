import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export function StatCardsSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className={`grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-${count} gap-4`}>
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i}>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-8 w-16" />
              </div>
              <Skeleton className="h-11 w-11 rounded-full" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function TableSkeleton({
  rows = 8,
  cols = 5,
  showSearch = true,
  showFilters = false,
  filterCount = 2,
}: {
  rows?: number;
  cols?: number;
  showSearch?: boolean;
  showFilters?: boolean;
  filterCount?: number;
}) {
  return (
    <Card>
      {showSearch && (
        <div className="p-4 border-b flex items-center gap-3 flex-wrap">
          <Skeleton className="h-9 w-48" />
          {showFilters &&
            Array.from({ length: filterCount }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-36" />
            ))}
          <div className="ml-auto">
            <Skeleton className="h-9 w-28" />
          </div>
        </div>
      )}
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                {Array.from({ length: cols }).map((_, i) => (
                  <th key={i} className="px-4 py-3 text-left">
                    <Skeleton className="h-4 w-20" />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: rows }).map((_, r) => (
                <tr key={r} className="border-b last:border-0">
                  {Array.from({ length: cols }).map((_, c) => (
                    <td key={c} className="px-4 py-3">
                      <Skeleton className={`h-4 ${c === 0 ? "w-20" : c === cols - 1 ? "w-16" : "w-28"}`} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

export function PageHeadingSkeleton() {
  return (
    <div className="space-y-1">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-4 w-72" />
    </div>
  );
}

export function FormCardSkeleton({ fields = 4 }: { fields?: number }) {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-4 w-64" />
      </CardHeader>
      <CardContent className="space-y-4">
        {Array.from({ length: fields }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-10 w-full" />
          </div>
        ))}
        <Skeleton className="h-10 w-32 mt-2" />
      </CardContent>
    </Card>
  );
}

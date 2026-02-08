import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-6">
      {/* Tenant selector skeleton */}
      <div className="flex items-center gap-2">
        <Skeleton className="h-4 w-4" />
        <Skeleton className="h-10 w-[260px]" />
      </div>
      {/* Filters */}
      <div className="flex gap-3">
        <Skeleton className="h-10 flex-1 min-w-[250px]" />
        <Skeleton className="h-10 w-[180px]" />
        <Skeleton className="h-10 w-[180px]" />
      </div>
      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <div className="bg-muted/50 p-3">
          <div className="grid grid-cols-7 gap-4">
            {Array.from({ length: 7 }).map((_, i) => (
              <Skeleton key={i} className="h-4" />
            ))}
          </div>
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="p-3 border-t">
            <div className="grid grid-cols-7 gap-4 items-center">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-16" />
              <div className="flex items-center gap-2">
                <Skeleton className="h-8 w-8 rounded-full" />
                <Skeleton className="h-4 w-24" />
              </div>
              <Skeleton className="h-6 w-16 rounded-md" />
              <Skeleton className="h-6 w-16 rounded-md" />
              <Skeleton className="h-4 w-16 ml-auto" />
              <Skeleton className="h-8 w-8 mx-auto rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-36" />
        <Skeleton className="h-10 w-32" />
      </div>
      <Skeleton className="h-10 w-full" />
      <div className="border rounded-lg overflow-hidden">
        <div className="bg-muted/50 p-3">
          <div className="grid grid-cols-6 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-4" />
            ))}
          </div>
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="p-3 border-t">
            <div className="grid grid-cols-6 gap-4 items-center">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-6 w-16 rounded-md" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-6 w-16 rounded-md" />
              <Skeleton className="h-8 w-8 mx-auto rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

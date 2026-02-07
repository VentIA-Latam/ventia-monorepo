import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-9 w-32" />
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-40 mt-2" />
        </div>
        <Skeleton className="h-8 w-24 rounded-md" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Skeleton className="h-64 rounded-lg" />
          <Skeleton className="h-48 rounded-lg" />
        </div>
        <div className="space-y-6">
          <Skeleton className="h-40 rounded-lg" />
          <Skeleton className="h-32 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

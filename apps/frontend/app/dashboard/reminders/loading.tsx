import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-80 mt-2" />
      </div>
      <Skeleton className="h-12 w-full rounded-lg" />
      <div className="space-y-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="border rounded-lg p-6 space-y-3">
            <div className="flex justify-between items-center">
              <Skeleton className="h-5 w-52" />
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>
            <Skeleton className="h-24 w-full" />
            <div className="flex justify-end">
              <Skeleton className="h-4 w-16" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

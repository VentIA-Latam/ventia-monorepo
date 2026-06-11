import { Megaphone } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function CampaignsLoading() {
  return (
    <div className="space-y-6">
      <header className="flex items-center gap-3">
        <div className="rounded-lg bg-volt/10 p-3">
          <Megaphone className="h-6 w-6 text-volt" />
        </div>
        <div className="space-y-1.5">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-3.5 w-72" />
        </div>
      </header>

      {/* Filter pills */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-7 w-20 rounded-full" />
          ))}
        </div>
        <Skeleton className="h-8 w-32" />
      </div>

      {/* Card list */}
      <div className="space-y-2.5">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-border bg-card p-4 space-y-2"
          >
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-3 w-72" />
          </div>
        ))}
      </div>
    </div>
  );
}

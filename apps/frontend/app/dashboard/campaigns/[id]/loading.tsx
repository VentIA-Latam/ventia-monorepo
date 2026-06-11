import { Skeleton } from "@/components/ui/skeleton";

export default function CampaignDetailLoading() {
  return (
    <div className="space-y-4">
      {/* Crumb */}
      <Skeleton className="h-4 w-64" />

      {/* Main panel */}
      <section className="rounded-xl border border-border bg-card">
        <header className="space-y-3 p-5">
          <Skeleton className="h-6 w-72" />
          <div className="flex gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-4 w-24" />
            ))}
          </div>
        </header>

        {/* Ratios row */}
        <div className="grid grid-cols-3 gap-8 border-t border-border px-6 py-5">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-9 w-24" />
              <Skeleton className="h-3 w-32" />
            </div>
          ))}
        </div>

        {/* Pipeline */}
        <div className="border-t border-border px-6 py-5 space-y-3">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-3 w-full rounded-full" />
        </div>
      </section>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card">
        <div className="border-b border-border px-5 py-3.5">
          <Skeleton className="h-4 w-40" />
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 border-b border-border px-5 py-3 last:border-b-0"
          >
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}

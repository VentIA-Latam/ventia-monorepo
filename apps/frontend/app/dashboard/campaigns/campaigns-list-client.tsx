"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertCircle, Megaphone, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Campaign } from "@/lib/types/campaign";
import { CampaignCard } from "./_components/campaign-card";

type StatusFilter = "all" | "draft" | "scheduled" | "sent" | "in_progress";

interface FilterDef {
  key: StatusFilter;
  label: string;
  /** Statuses incluidos cuando este filtro está activo */
  matches: (c: Campaign) => boolean;
}

const FILTERS: FilterDef[] = [
  { key: "all", label: "Todas", matches: () => true },
  {
    key: "draft",
    label: "Borradores",
    matches: (c) => c.campaign_status === "draft",
  },
  {
    key: "scheduled",
    label: "Programadas",
    matches: (c) =>
      c.campaign_status === "active" &&
      !!c.scheduled_at &&
      new Date(c.scheduled_at).getTime() > Date.now(),
  },
  {
    key: "in_progress",
    label: "En curso",
    matches: (c) =>
      c.campaign_status === "running" || c.campaign_status === "paused",
  },
  {
    key: "sent",
    label: "Enviadas",
    matches: (c) =>
      c.campaign_status === "completed" || c.campaign_status === "failed",
  },
];

interface Props {
  initialCampaigns: Campaign[];
  loadError: string | null;
}

export function CampaignsListClient({ initialCampaigns, loadError }: Props) {
  const [activeFilter, setActiveFilter] = useState<StatusFilter>("all");

  // Contadores per-filter para los badges en los tabs
  const counts = useMemo(() => {
    const result: Record<StatusFilter, number> = {
      all: initialCampaigns.length,
      draft: 0,
      scheduled: 0,
      in_progress: 0,
      sent: 0,
    };
    for (const c of initialCampaigns) {
      for (const f of FILTERS) {
        if (f.key !== "all" && f.matches(c)) result[f.key]++;
      }
    }
    return result;
  }, [initialCampaigns]);

  const filtered = useMemo(
    () => initialCampaigns.filter(FILTERS.find((f) => f.key === activeFilter)!.matches),
    [activeFilter, initialCampaigns]
  );

  if (loadError) {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-[var(--danger)]/30 bg-[var(--danger-bg)] p-4 text-sm text-[var(--danger)]">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          <div className="font-medium">No pudimos cargar las campañas</div>
          <div className="mt-0.5 text-xs opacity-80">{loadError}</div>
        </div>
      </div>
    );
  }

  if (initialCampaigns.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="space-y-4">
      {/* Filter row + CTA */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {FILTERS.map((f) => (
            <FilterPill
              key={f.key}
              active={activeFilter === f.key}
              count={counts[f.key]}
              onClick={() => setActiveFilter(f.key)}
            >
              {f.label}
            </FilterPill>
          ))}
        </div>
        <Button asChild size="sm">
          <Link href="/dashboard/campaigns/new">
            <Plus className="h-4 w-4" />
            Nueva campaña
          </Link>
        </Button>
      </div>

      {/* Cards */}
      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No hay campañas en este estado.
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map((c) => (
            <CampaignCard key={c.id} campaign={c} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────

function FilterPill({
  active,
  count,
  onClick,
  children,
}: {
  active: boolean;
  count: number;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium transition",
        active
          ? "bg-foreground text-background"
          : "bg-muted text-muted-foreground hover:bg-muted/70 hover:text-foreground"
      )}
    >
      {children}
      <span
        className={cn(
          "rounded-full px-1.5 py-0 text-xs tabular-nums",
          active ? "bg-background/15" : "bg-background"
        )}
      >
        {count}
      </span>
    </button>
  );
}

function EmptyState() {
  return (
    <div className="rounded-xl border border-border bg-card p-10 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-volt/10">
        <Megaphone className="h-6 w-6 text-volt" />
      </div>
      <h3 className="mt-4 font-heading text-lg font-semibold text-foreground">
        Aún no tenés campañas
      </h3>
      <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
        Las campañas masivas te permiten enviar templates de WhatsApp a un grupo
        de contactos en pocos pasos.
      </p>
      <Button asChild className="mt-5">
        <Link href="/dashboard/campaigns/new">
          <Plus className="h-4 w-4" />
          Crear primera campaña
        </Link>
      </Button>
    </div>
  );
}


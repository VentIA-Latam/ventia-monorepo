"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Megaphone, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAccessToken } from "@/hooks/use-access-token";
import { useToast } from "@/hooks/use-toast";
import { createCampaign } from "@/lib/services/campaigns-service";
import { fetchInboxes } from "@/lib/services/messaging-service";
import { cn } from "@/lib/utils";
import type { Campaign } from "@/lib/types/campaign";
import { CampaignCard } from "@/components/dashboard/campaigns/campaign-card";

interface InboxShape {
  id: number;
  name: string;
  channel_type?: string;
}

function isWhatsAppInbox(inbox: unknown): inbox is InboxShape {
  if (!inbox || typeof inbox !== "object") return false;
  const i = inbox as Record<string, unknown>;
  return (
    typeof i.id === "number" &&
    typeof i.name === "string" &&
    (i.channel_type === undefined || i.channel_type === "Channel::Whatsapp")
  );
}

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
  const accessToken = useAccessToken();
  const router = useRouter();
  const { toast } = useToast();
  const [activeFilter, setActiveFilter] = useState<StatusFilter>("all");
  const [creating, setCreating] = useState(false);

  // Crear draft on-click. Antes vivía en un Server Action (actions.ts) por el bug de
  // RSC + prefetch: el `new/page.tsx` original disparaba `createCampaign` al hacer
  // prefetch del Link, generando drafts huérfanos. Acá no hay Link a /new ni RSC →
  // el handler corre solo cuando el usuario clickea. Match con el patrón del resto
  // del dashboard (useAccessToken + fetch + router.push).
  const onCreateClick = useCallback(async () => {
    if (!accessToken || creating) return;
    setCreating(true);
    try {
      const result = await fetchInboxes(accessToken);
      const data = Array.isArray(result)
        ? result
        : ((result as { data?: unknown }).data ?? []);
      const inboxes = Array.isArray(data)
        ? data.filter(isWhatsAppInbox)
        : [];

      if (inboxes.length === 0) {
        toast({
          title: "Sin inbox de WhatsApp",
          description: "Configura un inbox de WhatsApp antes de crear campañas.",
          variant: "destructive",
        });
        setCreating(false);
        return;
      }

      const response = await createCampaign(accessToken, {
        title: "Nueva campaña sin nombre",
        inbox_id: inboxes[0].id,
      });
      // NO resetear `creating` acá. El componente queda montado hasta que el
      // RSC del wizard llega — si resetea, el button vuelve a "Crear primera
      // campaña" por unos ms antes de navegar (flicker). Dejar en `true` para
      // que diga "Creando..." continuo hasta el unmount.
      router.push(`/dashboard/campaigns/${response.data.id}/edit?step=1`);
    } catch (e) {
      toast({
        title: "No se pudo crear la campaña",
        description: e instanceof Error ? e.message : "Inténtalo de nuevo",
        variant: "destructive",
      });
      setCreating(false);
    }
  }, [accessToken, creating, router, toast]);

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
    return (
      <EmptyState onCreate={onCreateClick} creating={creating} disabled={!accessToken} />
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter row + CTA */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          data-testid="campaigns-filter-pills"
          className="flex flex-wrap items-center gap-1.5"
        >
          {FILTERS.map((f) => (
            <FilterPill
              key={f.key}
              active={activeFilter === f.key}
              count={counts[f.key]}
              filterKey={f.key}
              onClick={() => setActiveFilter(f.key)}
            >
              {f.label}
            </FilterPill>
          ))}
        </div>
        <Button
          type="button"
          size="sm"
          data-testid="campaigns-new-button"
          onClick={onCreateClick}
          disabled={creating || !accessToken}
        >
          <Plus className="h-4 w-4" />
          {creating ? "Creando..." : "Nueva campaña"}
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
  filterKey,
  onClick,
  children,
}: {
  active: boolean;
  count: number;
  filterKey: StatusFilter;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      data-testid={`filter-pill-${filterKey}`}
      data-active={active}
      onClick={onClick}
      className={cn(
        "h-auto rounded-full px-3 py-1 text-sm font-medium",
        active
          ? "bg-volt text-primary-foreground hover:bg-volt/90 hover:text-primary-foreground"
          : "bg-muted text-muted-foreground hover:bg-muted/70 hover:text-foreground"
      )}
    >
      {children}
      <span
        className={cn(
          "ml-1.5 rounded-full px-1.5 py-0 text-xs tabular-nums",
          active ? "bg-background/15 text-primary-foreground" : "bg-background"
        )}
      >
        {count}
      </span>
    </Button>
  );
}

function EmptyState({
  onCreate,
  creating,
  disabled,
}: {
  onCreate: () => void;
  creating: boolean;
  disabled: boolean;
}) {
  return (
    <div
      data-testid="campaigns-empty-state"
      className="rounded-xl border border-border bg-card p-10 text-center"
    >
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-volt/10">
        <Megaphone className="h-6 w-6 text-volt" />
      </div>
      <h3 className="mt-4 font-heading text-lg font-semibold text-foreground">
        Aún no tienes campañas
      </h3>
      <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
        Las campañas masivas te permiten enviar templates de WhatsApp a un grupo
        de contactos en pocos pasos.
      </p>
      <Button
        type="button"
        data-testid="campaigns-empty-state-create-button"
        onClick={onCreate}
        disabled={creating || disabled}
        className="mt-5"
      >
        <Plus className="h-4 w-4" />
        {creating ? "Creando..." : "Crear primera campaña"}
      </Button>
    </div>
  );
}


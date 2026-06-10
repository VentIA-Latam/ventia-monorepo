"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Calendar, FileText, Inbox, Megaphone, RefreshCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAccessToken } from "@/hooks/use-access-token";
import { useToast } from "@/hooks/use-toast";
import { fetchCampaign } from "@/lib/services/campaigns-service";
import { formatDateTime } from "@/lib/utils";
import type {
  Campaign,
  CampaignRecipient,
  CampaignStats,
  PaginationMeta,
} from "@/lib/types/campaign";
import { CampaignStatusPill } from "@/components/dashboard/campaigns/campaign-status-pill";
import { StatsRatios } from "@/components/dashboard/campaigns/stats-ratios";
import { CampaignPipelineBar } from "@/components/dashboard/campaigns/campaign-pipeline-bar";
import { RecipientsTable } from "@/components/dashboard/campaigns/recipients-table";
import { RetryFailedDialog } from "@/components/dashboard/campaigns/retry-failed-dialog";
import { DeleteCampaignDialog } from "@/components/dashboard/campaigns/delete-campaign-dialog";

interface Props {
  initialCampaign: Campaign;
  initialRecipients: CampaignRecipient[];
  initialMeta: PaginationMeta;
}

const EMPTY_STATS: CampaignStats = {
  pending: 0,
  queued: 0,
  sent: 0,
  delivered: 0,
  read: 0,
  failed: 0,
  omitted: 0,
};

export function CampaignDetailClient({
  initialCampaign,
  initialRecipients,
  initialMeta,
}: Props) {
  const accessToken = useAccessToken();
  const router = useRouter();
  const { toast } = useToast();
  const [campaign, setCampaign] = useState(initialCampaign);

  // Polling cuando :running para refrescar stats.
  // - Cleanup on unmount.
  // - Pausa cuando la pestaña no es visible (document.visibilityState) para no gastar
  //   recursos ni cuota de API.
  useEffect(() => {
    if (!accessToken) return;
    if (campaign.campaign_status !== "running") return;

    const tick = async () => {
      // Skip si la pestaña no está visible — el usuario no ve el resultado igual.
      if (document.visibilityState !== "visible") return;
      try {
        const res = await fetchCampaign(accessToken, campaign.id);
        setCampaign(res.data);
      } catch {
        // silent: el siguiente tick reintentará
      }
    };
    const interval = setInterval(tick, 3000);
    // Dispará un tick inmediato al volver a foco para refrescar sin esperar 3s.
    const onVisible = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [accessToken, campaign.campaign_status, campaign.id]);

  const stats = campaign.stats ?? EMPTY_STATS;

  // `now` se actualiza cada 60s mientras la campaña esté `:active` con scheduled_at
  // futuro — así el banner "Programada para…" desaparece sin esperar a polling
  // (que recién arranca cuando el cron flipea status a :running).
  const [now, setNow] = useState(() => Date.now());
  const scheduledMs = campaign.scheduled_at
    ? new Date(campaign.scheduled_at).getTime()
    : null;
  const isScheduledFuture =
    campaign.campaign_status === "active" &&
    scheduledMs !== null &&
    scheduledMs > now;

  useEffect(() => {
    if (!isScheduledFuture) return;
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, [isScheduledFuture]);

  const onRetried = async (count: number) => {
    toast({
      title: `Reintentando ${count} destinatarios`,
      description: "Los fallos se procesarán en segundos.",
    });
    if (accessToken) {
      const res = await fetchCampaign(accessToken, campaign.id);
      setCampaign(res.data);
    }
    // Invalidá la RSC payload de la lista para que reflejé el nuevo status al volver.
    router.refresh();
  };

  const onDeleted = () => {
    toast({ title: "Campaña borrada" });
    router.push("/dashboard/campaigns");
    router.refresh();
  };

  return (
    <div className="space-y-4">
      {/* Crumb */}
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link
          href="/dashboard/campaigns"
          className="inline-flex items-center gap-1.5 hover:text-foreground"
        >
          <Megaphone className="h-3.5 w-3.5" />
          Campañas
        </Link>
        <span className="text-muted-foreground/50">/</span>
        <strong className="text-foreground">{campaign.title}</strong>
      </div>

      {/* Panel principal: header + ratios + pipeline */}
      <section className="rounded-xl border border-border bg-card">
        <header className="flex items-start justify-between gap-4 p-5">
          <div className="min-w-0">
            <h1 className="font-heading text-xl font-bold tracking-tight text-foreground">
              {campaign.title}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <CampaignStatusPill status={campaign.campaign_status} />
              <span className="inline-flex items-center gap-1">
                <Inbox className="h-3 w-3" />
                {campaign.inbox.name}
              </span>
              {campaign.template_params?.name && (
                <span className="inline-flex items-center gap-1">
                  <FileText className="h-3 w-3" />
                  {campaign.template_params.name} · {campaign.template_params.language}
                </span>
              )}
              {campaign.triggered_at && (
                <span className="inline-flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {formatDateTime(campaign.triggered_at)}
                </span>
              )}
            </div>
          </div>

          <div className="flex shrink-0 gap-2">
            {campaign.campaign_status === "completed" && stats.failed > 0 && (
              <RetryFailedDialog
                campaignId={campaign.id}
                failedCount={stats.failed}
                onRetried={onRetried}
              >
                <Button size="sm" variant="outline" className="text-[var(--warning)] border-[var(--warning)]/40">
                  <RefreshCcw className="h-3.5 w-3.5" />
                  Reintentar {stats.failed}
                </Button>
              </RetryFailedDialog>
            )}
            <DeleteCampaignDialog
              campaignId={campaign.id}
              recipientsCount={campaign.recipients_count}
              onDeleted={onDeleted}
            >
              <Button size="sm" variant="ghost" className="text-[var(--danger)]">
                <Trash2 className="h-3.5 w-3.5" />
                Borrar
              </Button>
            </DeleteCampaignDialog>
          </div>
        </header>

        {isScheduledFuture && (
          <div className="mx-5 mb-4 rounded-lg border border-[var(--warning)]/30 bg-[var(--warning-bg)] px-3 py-2 text-sm text-[var(--warning)]">
            <strong>Programada</strong> para{" "}
            {campaign.scheduled_at && formatDateTime(campaign.scheduled_at)}.
            El cron la dispara automáticamente.
          </div>
        )}

        {campaign.campaign_status === "failed" && (
          <div className="mx-5 mb-4 rounded-lg border border-[var(--danger)]/30 bg-[var(--danger-bg)] px-3 py-2 text-sm text-[var(--danger)]">
            <strong>La campaña falló durante el disparo.</strong> Revisa los logs e intenta de nuevo.
          </div>
        )}

        <StatsRatios stats={stats} recipientsCount={campaign.recipients_count} />
        <CampaignPipelineBar
          stats={stats}
          recipientsCount={campaign.recipients_count}
        />
      </section>

      {/* Tabla de recipients */}
      <RecipientsTable
        campaignId={campaign.id}
        initialRecipients={initialRecipients}
        initialMeta={initialMeta}
      />
    </div>
  );
}

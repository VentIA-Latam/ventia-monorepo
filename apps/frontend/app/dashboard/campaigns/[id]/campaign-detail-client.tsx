"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Calendar, FileText, Inbox, RefreshCcw, Trash2 } from "lucide-react";
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
import { CampaignStatusPill } from "../_components/campaign-status-pill";
import { StatsRatios } from "../_components/stats-ratios";
import { CampaignPipelineBar } from "../_components/campaign-pipeline-bar";
import { RecipientsTable } from "../_components/recipients-table";
import { RetryFailedDialog } from "../_components/retry-failed-dialog";
import { DeleteCampaignDialog } from "../_components/delete-campaign-dialog";

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

  // Polling cuando :running para refrescar stats. Cleanup on unmount.
  useEffect(() => {
    if (!accessToken) return;
    if (campaign.campaign_status !== "running") return;

    const tick = async () => {
      try {
        const res = await fetchCampaign(accessToken, campaign.id);
        setCampaign(res.data);
      } catch {
        // silent: el siguiente tick reintentará
      }
    };
    const interval = setInterval(tick, 3000);
    return () => clearInterval(interval);
  }, [accessToken, campaign.campaign_status, campaign.id]);

  const stats = campaign.stats ?? EMPTY_STATS;
  const isScheduledFuture =
    campaign.campaign_status === "active" &&
    campaign.scheduled_at &&
    // eslint-disable-next-line react-hooks/purity
    new Date(campaign.scheduled_at).getTime() > Date.now();

  const onRetried = async (count: number) => {
    toast({
      title: `Reintentando ${count} destinatarios`,
      description: "Los fallos se procesarán en segundos.",
    });
    if (accessToken) {
      const res = await fetchCampaign(accessToken, campaign.id);
      setCampaign(res.data);
    }
  };

  const onDeleted = () => {
    toast({ title: "Campaña borrada" });
    router.push("/dashboard/campaigns");
  };

  return (
    <div className="space-y-4">
      {/* Crumb */}
      <div className="text-sm text-muted-foreground">
        <Link href="/dashboard/campaigns" className="hover:text-foreground">
          📢 Campañas
        </Link>{" "}
        <span className="text-border">/</span>{" "}
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
            <strong>La campaña falló durante el disparo.</strong> Revisá logs y reintentá.
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

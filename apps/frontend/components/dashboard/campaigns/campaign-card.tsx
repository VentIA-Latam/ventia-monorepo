"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Calendar, FileText, Inbox, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/utils";
import type { Campaign } from "@/lib/types/campaign";
import { CampaignStatusPill } from "./campaign-status-pill";
import { DeleteCampaignDialog } from "./delete-campaign-dialog";

interface Props {
  campaign: Campaign;
}

/**
 * Card-per-row de campaña: clickeable, muestra título + status pill + metadata + counts.
 * Si la campaña tiene recipients, agrega progress bar inline con porcentaje de envío.
 * Click → /campaigns/{id} (detalle) o /campaigns/{id}/edit?step=1 si :draft.
 *
 * Drafts adicionalmente muestran un botón de borrar (icon) absolutamente posicionado
 * arriba del Link wrapper. Patrón estándar: Link envuelve todo el contenido (clickeable
 * en cualquier punto), trash button vive afuera como sibling con z-10 para overlayar.
 */
export function CampaignCard({ campaign }: Props) {
  const router = useRouter();
  const isDraft = campaign.campaign_status === "draft";
  const href = isDraft
    ? `/dashboard/campaigns/${campaign.id}/edit?step=1`
    : `/dashboard/campaigns/${campaign.id}`;

  const templateName = campaign.template_params?.name;
  const dispatchedPct =
    campaign.recipients_count > 0
      ? Math.round((campaign.sent_count / campaign.recipients_count) * 100)
      : 0;
  const failedPct =
    campaign.recipients_count > 0
      ? Math.round((campaign.failed_count / campaign.recipients_count) * 100)
      : 0;
  const omittedCount = (campaign.stats?.omitted ?? 0) || 0;

  const onDraftDeleted = () => {
    router.refresh();
  };

  return (
    <div
      data-testid={`campaign-card-${campaign.id}`}
      data-status={campaign.campaign_status}
      className={cn(
        "group relative rounded-xl border border-border bg-card transition",
        "hover:border-volt/40 hover:shadow-sm",
        isDraft && "border-dashed"
      )}
    >
      <Link
        href={href}
        className={cn(
          "block p-4",
          // Hacé espacio para el trash button absolute (drafts solamente).
          isDraft && "pr-12"
        )}
        aria-label={`Abrir campaña ${campaign.title}`}
      >
        <div className="flex items-start justify-between gap-3">
          {/* Left: title + status + meta */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="truncate text-sm font-semibold text-foreground">
                {campaign.title}
              </h3>
              <CampaignStatusPill status={campaign.campaign_status} />
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              {templateName && (
                <span className="inline-flex items-center gap-1">
                  <FileText className="h-3 w-3" />
                  {templateName}
                </span>
              )}
              <span className="inline-flex items-center gap-1">
                <Inbox className="h-3 w-3" />
                {campaign.inbox.name}
              </span>
              {campaign.scheduled_at && !isDraft && (
                <span className="inline-flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {campaign.triggered_at
                    ? formatDateTime(campaign.triggered_at)
                    : formatDateTime(campaign.scheduled_at)}
                </span>
              )}
            </div>
          </div>

          {/* Right: counts (solo cuando la campaña tiene recipients y NO es draft) */}
          {!isDraft && campaign.recipients_count > 0 && (
            <div className="flex shrink-0 flex-col items-end gap-1">
              <div className="text-sm font-medium text-foreground tabular-nums">
                {campaign.recipients_count} destinatarios
              </div>
              {(campaign.sent_count > 0 || campaign.failed_count > 0 || omittedCount > 0) && (
                <div className="flex items-center gap-1.5 text-xs">
                  {campaign.sent_count > 0 && (
                    <span className="rounded bg-[color-mix(in_oklch,var(--marino)_10%,transparent)] px-1.5 py-0.5 font-medium text-[var(--marino)] tabular-nums">
                      {campaign.sent_count} enviados
                    </span>
                  )}
                  {campaign.failed_count > 0 && (
                    <span className="rounded bg-[var(--danger-bg)] px-1.5 py-0.5 font-medium text-[var(--danger)] tabular-nums">
                      {campaign.failed_count} fallos
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Right: "Continuar →" hint (solo drafts) */}
          {isDraft && (
            <span className="shrink-0 whitespace-nowrap text-xs font-medium text-volt group-hover:underline">
              Continuar →
            </span>
          )}
        </div>

        {/* Progress bar (solo si hay recipients y la campaña arrancó) */}
        {campaign.recipients_count > 0 && campaign.triggered_at && (
          <div className="relative mt-3 flex h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="bg-[var(--marino)]"
              style={{ width: `${dispatchedPct - failedPct}%` }}
              aria-label={`${dispatchedPct - failedPct}% enviados`}
            />
            {failedPct > 0 && (
              <div
                className="bg-[var(--danger)]"
                style={{ width: `${failedPct}%` }}
                aria-label={`${failedPct}% fallaron`}
              />
            )}
          </div>
        )}
      </Link>

      {/* Trash button (drafts): absolute + z-10 para overlayar el Link.
          stopPropagation por defensa-en-profundidad; el button está fuera del <a>
          así que la navegación no se dispararía igual, pero no cuesta nada. */}
      {isDraft && (
        <div className="absolute right-3 top-3 z-10">
          <DeleteCampaignDialog
            campaignId={campaign.id}
            recipientsCount={campaign.recipients_count}
            onDeleted={onDraftDeleted}
          >
            <Button
              type="button"
              variant="ghost"
              size="icon"
              data-testid={`campaign-card-delete-${campaign.id}`}
              aria-label="Borrar borrador"
              className="h-7 w-7 text-muted-foreground hover:bg-[var(--danger-bg)] hover:text-[var(--danger)]"
              onClick={(e) => e.stopPropagation()}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </DeleteCampaignDialog>
        </div>
      )}
    </div>
  );
}

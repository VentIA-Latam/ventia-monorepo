"use client";

import Link from "next/link";
import { Calendar, FileText, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/utils";
import type { Campaign } from "@/lib/types/campaign";
import { CampaignStatusPill } from "./campaign-status-pill";

interface Props {
  campaign: Campaign;
}

/**
 * Card-per-row de campaña: clickeable, muestra título + status pill + metadata + counts.
 * Si la campaña tiene recipients, agrega progress bar inline con porcentaje de envío.
 * Click → /campaigns/{id} (detalle) o /campaigns/{id}/edit?step=1 si :draft.
 */
export function CampaignCard({ campaign }: Props) {
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
  const omittedCount =
    (campaign.stats?.omitted ?? 0) || 0;

  return (
    <Link
      href={href}
      className={cn(
        "group block rounded-xl border border-border bg-card p-4 transition",
        "hover:border-volt/40 hover:shadow-sm",
        isDraft && "border-dashed"
      )}
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

        {/* Right: counts */}
        {campaign.recipients_count > 0 && (
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

        {isDraft && (
          <span className="shrink-0 text-xs font-medium text-volt group-hover:underline">
            Continuar →
          </span>
        )}
      </div>

      {/* Progress bar (solo si hay recipients y la campaña arrancó) */}
      {campaign.recipients_count > 0 && campaign.triggered_at && (
        <div className="mt-3 flex h-1.5 overflow-hidden rounded-full bg-muted">
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
  );
}

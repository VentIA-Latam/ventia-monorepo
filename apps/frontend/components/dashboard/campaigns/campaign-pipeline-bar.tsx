import type { CampaignStats } from "@/lib/types/campaign";

interface Props {
  stats: CampaignStats;
  recipientsCount: number;
}

/**
 * Stacked bar visualizando el reparto de status de los recipients.
 * Segmentos:
 *   - read     (marino, azul profundo)
 *   - delivered (volt, brand primary)
 *   - sent     (aqua, claro)
 *   - failed   (danger)
 *   - omitted  (warning)
 * Leyenda inferior con cuentas.
 */
export function CampaignPipelineBar({ stats, recipientsCount }: Props) {
  const total = recipientsCount || 1;
  const read = stats.read;
  const delivered = stats.delivered;
  const sent = stats.sent;
  const failed = stats.failed;
  const omitted = stats.omitted;
  // pending + queued se muestran como espacio gris (resto del bar).

  const seg = (count: number) => (count / total) * 100;

  return (
    <div className="border-t border-border px-6 py-5">
      <div className="mb-2.5 flex items-baseline justify-between">
        <span className="text-sm font-semibold text-foreground">Pipeline</span>
        <span className="text-xs text-muted-foreground">
          {recipientsCount} destinatarios totales
        </span>
      </div>

      <div className="flex h-3 overflow-hidden rounded-full bg-muted">
        {read > 0 && (
          <div
            className="bg-[var(--marino)]"
            style={{ width: `${seg(read)}%` }}
            aria-label={`${read} leídos`}
          />
        )}
        {delivered > 0 && (
          <div
            className="bg-[color-mix(in_oklch,var(--volt)_85%,transparent)]"
            style={{ width: `${seg(delivered)}%` }}
            aria-label={`${delivered} entregados`}
          />
        )}
        {sent > 0 && (
          <div
            className="bg-[var(--aqua)]"
            style={{ width: `${seg(sent)}%` }}
            aria-label={`${sent} enviados sin webhook todavía`}
          />
        )}
        {failed > 0 && (
          <div
            className="bg-[var(--danger)]"
            style={{ width: `${seg(failed)}%` }}
            aria-label={`${failed} fallaron`}
          />
        )}
        {omitted > 0 && (
          <div
            className="bg-[color-mix(in_oklch,var(--warning)_70%,var(--muted))]"
            style={{ width: `${seg(omitted)}%` }}
            aria-label={`${omitted} omitidos`}
          />
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
        <LegendItem color="var(--marino)" label="Leídos" count={read} />
        <LegendItem
          color="color-mix(in oklch, var(--volt) 85%, transparent)"
          label="Entregados"
          count={delivered}
        />
        {sent > 0 && <LegendItem color="var(--aqua)" label="Enviados" count={sent} />}
        {failed > 0 && (
          <LegendItem color="var(--danger)" label="Fallaron" count={failed} />
        )}
        {omitted > 0 && (
          <LegendItem
            color="color-mix(in oklch, var(--warning) 70%, var(--muted))"
            label="Omitidos"
            count={omitted}
          />
        )}
      </div>
    </div>
  );
}

function LegendItem({
  color,
  label,
  count,
}: {
  color: string;
  label: string;
  count: number;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 tabular-nums">
      <span
        className="inline-block h-2 w-2 rounded-sm"
        style={{ backgroundColor: color }}
        aria-hidden
      />
      {label} <strong className="text-foreground">{count}</strong>
    </span>
  );
}

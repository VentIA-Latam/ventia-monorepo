import type { CampaignStats } from "@/lib/types/campaign";

interface Props {
  stats: CampaignStats;
  recipientsCount: number;
}

/**
 * 3 ratios destacados: entregados, leídos, fallaron+omitidos. Reemplaza el "hero-metric
 * template" cliché de 6 stat cards iguales. Cada ratio muestra %, fracción y label
 * en uppercase pequeño (patrón data-dense pro).
 */
export function StatsRatios({ stats, recipientsCount }: Props) {
  const sent = stats.sent + stats.delivered + stats.read;
  const delivered = stats.delivered + stats.read;
  const read = stats.read;
  const failedOrOmitted = stats.failed + stats.omitted;

  const pct = (num: number, den: number): string => {
    if (den === 0) return "—";
    return ((num / den) * 100).toFixed(1) + "%";
  };

  return (
    <div className="grid grid-cols-3 gap-8 border-t border-border px-6 py-5">
      <Ratio
        label="Entregados"
        value={pct(delivered, sent)}
        sub={
          <>
            <strong className="text-foreground">{delivered}</strong> de {sent} enviados
          </>
        }
      />
      <Ratio
        label="Leídos"
        value={pct(read, delivered)}
        sub={
          <>
            <strong className="text-foreground">{read}</strong> de {delivered} entregados
          </>
        }
      />
      <Ratio
        label="Fallaron + omitidos"
        value={pct(failedOrOmitted, recipientsCount)}
        sub={
          <>
            <strong className="text-foreground">{failedOrOmitted}</strong> de {recipientsCount} destinatarios
          </>
        }
      />
    </div>
  );
}

function Ratio({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="text-[32px] font-semibold leading-none tracking-tight tabular-nums text-foreground">
        {value}
      </div>
      <div className="text-xs text-muted-foreground tabular-nums">{sub}</div>
    </div>
  );
}

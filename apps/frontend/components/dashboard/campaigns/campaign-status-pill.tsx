import { cn } from "@/lib/utils";
import type { CampaignStatus } from "@/lib/types/campaign";

interface Props {
  status: CampaignStatus;
  className?: string;
}

interface PillStyle {
  label: string;
  className: string; // Bg tint + foreground + dot
}

/**
 * Mapeo declarativo de campaign_status → pill styling.
 * Sigue tabla del spec (sección "Mapeo estado → color"):
 *
 * | Estado     | Bg                     | Fg              |
 * | draft      | muted                  | muted-foreground |
 * | active     | warning-bg             | warning         |
 * | running    | cielo                  | marino          |
 * | paused     | muted                  | muted-foreground |
 * | completed  | success-bg             | success         |
 * | failed     | danger-bg              | danger          |
 *
 * Dot prefix de color sólido del token; bg con mix transparente.
 */
const STYLES: Record<CampaignStatus, PillStyle> = {
  draft: {
    label: "Borrador",
    className: "bg-muted text-muted-foreground before:bg-muted-foreground",
  },
  active: {
    label: "Programada",
    className:
      "bg-[var(--warning-bg)] text-[var(--warning)] before:bg-[var(--warning)]",
  },
  running: {
    label: "Enviando",
    className:
      "bg-[color-mix(in_oklch,var(--marino)_12%,transparent)] text-[var(--marino)] before:bg-[var(--marino)]",
  },
  paused: {
    label: "Pausada",
    className: "bg-muted text-muted-foreground before:bg-muted-foreground",
  },
  completed: {
    label: "Enviada",
    className:
      "bg-[var(--success-bg)] text-[var(--success)] before:bg-[var(--success)]",
  },
  failed: {
    label: "Falló",
    className:
      "bg-[var(--danger-bg)] text-[var(--danger)] before:bg-[var(--danger)]",
  },
};

export function CampaignStatusPill({ status, className }: Props) {
  const style = STYLES[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold",
        "before:content-[''] before:w-1.5 before:h-1.5 before:rounded-full",
        style.className,
        className
      )}
    >
      {style.label}
    </span>
  );
}

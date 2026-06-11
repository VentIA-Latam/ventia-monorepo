import { cn } from "@/lib/utils";
import type { RecipientStatus } from "@/lib/types/campaign";

interface Props {
  status: RecipientStatus;
  className?: string;
}

interface PillStyle {
  label: string;
  className: string;
}

/**
 * Mapeo de recipient_status → pill. Marino (azul profundo) para :read porque es el
 * estado de mayor compromiso del destinatario. Aqua/Volt para entregas y envíos.
 * Spec: sección "Mapeo estado → color".
 */
const STYLES: Record<RecipientStatus, PillStyle> = {
  pending: {
    label: "Pendiente",
    className: "bg-muted text-muted-foreground before:bg-muted-foreground",
  },
  queued: {
    label: "En cola",
    className: "bg-muted text-muted-foreground before:bg-muted-foreground",
  },
  sent: {
    label: "Enviado",
    className:
      "bg-[color-mix(in_oklch,var(--aqua)_18%,transparent)] text-[color-mix(in_oklch,var(--aqua)_75%,var(--noche))] before:bg-[var(--aqua)]",
  },
  delivered: {
    label: "Entregado",
    className:
      "bg-[color-mix(in_oklch,var(--volt)_12%,transparent)] text-[var(--volt)] before:bg-[var(--volt)]",
  },
  read: {
    label: "Leído",
    className:
      "bg-[color-mix(in_oklch,var(--marino)_12%,transparent)] text-[var(--marino)] before:bg-[var(--marino)]",
  },
  failed: {
    label: "Falló",
    className:
      "bg-[var(--danger-bg)] text-[var(--danger)] before:bg-[var(--danger)]",
  },
  omitted: {
    label: "Omitido",
    className:
      "bg-[var(--warning-bg)] text-[var(--warning)] before:bg-[var(--warning)]",
  },
};

export function RecipientStatusPill({ status, className }: Props) {
  const style = STYLES[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold",
        "before:content-[''] before:w-1.5 before:h-1.5 before:rounded-full",
        style.className,
        className
      )}
    >
      {style.label}
    </span>
  );
}

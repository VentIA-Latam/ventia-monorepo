import type { LucideIcon } from "lucide-react"
import { AlertTriangle, Sliders, Sparkles } from "lucide-react"

export type TicketType = "critical_incident" | "agent_adjustment" | "additional_development"

export interface TicketTypeMeta {
  id: TicketType
  label: string
  description: string
  Icon: LucideIcon
  colorClass: string
  bgClass: string
  borderClass: string
  iconBgClass: string
}

export const TICKET_TYPES: TicketTypeMeta[] = [
  {
    id: "critical_incident",
    label: "Incidencia Crítica",
    description: "Errores o fallas del agente que afectan operación inmediata",
    Icon: AlertTriangle,
    colorClass: "text-danger",
    bgClass: "bg-danger-bg",
    borderClass: "border-danger/40",
    iconBgClass: "bg-danger/10",
  },
  {
    id: "agent_adjustment",
    label: "Ajuste al Agente",
    description: "Cambios menores de comportamiento o contenido",
    Icon: Sliders,
    colorClass: "text-aqua",
    bgClass: "bg-aqua/10",
    borderClass: "border-aqua/60",
    iconBgClass: "bg-aqua/20",
  },
  {
    id: "additional_development",
    label: "Desarrollo Adicional",
    description: "Mejoras o cambios estructurales profundos",
    Icon: Sparkles,
    colorClass: "text-luma",
    bgClass: "bg-luma/20",
    borderClass: "border-luma",
    iconBgClass: "bg-luma/30",
  },
]

export const TICKET_TYPE_MAP = new Map<TicketType, TicketTypeMeta>(
  TICKET_TYPES.map((t) => [t.id, t])
)

export const N8N_WEBHOOK_URL = "https://n8n.ventia-latam.com/webhook/clickup-test"

export const TICKET_TIPS = [
  "Indica fecha y hora aproximada del incidente.",
  "Adjunta el ID del chat si está disponible.",
  "Describe qué esperabas vs. qué ocurrió.",
  "Si es bug, incluye pasos para reproducir.",
]

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
    colorClass: "text-red-500",
    bgClass: "bg-red-50 dark:bg-red-950/20",
    borderClass: "border-red-400 dark:border-red-600",
    iconBgClass: "bg-red-100 dark:bg-red-900/30",
  },
  {
    id: "agent_adjustment",
    label: "Ajuste al Agente",
    description: "Cambios menores de comportamiento o contenido",
    Icon: Sliders,
    colorClass: "text-cielo",
    bgClass: "bg-cielo/5",
    borderClass: "border-cielo/60",
    iconBgClass: "bg-cielo/10",
  },
  {
    id: "additional_development",
    label: "Desarrollo Adicional",
    description: "Mejoras o cambios estructurales profundos",
    Icon: Sparkles,
    colorClass: "text-violet-500",
    bgClass: "bg-violet-50 dark:bg-violet-950/20",
    borderClass: "border-violet-400 dark:border-violet-600",
    iconBgClass: "bg-violet-100 dark:bg-violet-900/30",
  },
]

export const N8N_WEBHOOK_URL = "https://n8n.ventia-latam.com/webhook/clickup-test"

export const TICKET_TIPS = [
  "Indica fecha y hora aproximada del incidente.",
  "Adjunta el ID del chat si está disponible.",
  "Describe qué esperabas vs. qué ocurrió.",
  "Si es bug, incluye pasos para reproducir.",
]

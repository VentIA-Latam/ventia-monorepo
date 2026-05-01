import type { ReactNode } from "react"
import { Clock } from "lucide-react"
import { cn } from "@/lib/utils"
import { Card, CardContent } from "@/components/ui/card"
import { TICKET_TIPS, TICKET_TYPES, type TicketType } from "./ticket-constants"
import type { Conversation } from "@/lib/types/messaging"

interface TicketSidebarProps {
  type: TicketType | null
  charCount: number
  selectedConversation: Conversation | null
  showConvField: boolean
}

function SummaryRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs text-muted-foreground font-medium">{label}</span>
      <span>{children}</span>
    </div>
  )
}

export function TicketSidebar({ type, charCount, selectedConversation, showConvField }: TicketSidebarProps) {
  const selectedTypeMeta = TICKET_TYPES.find((t) => t.id === type)

  return (
    <aside className="lg:sticky lg:top-6 flex flex-col gap-4">

      <Card className="border-border bg-muted/20 shadow-none hover:shadow-none hover:translate-y-0">
        <CardContent className="p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Resumen
          </p>
          <div className="flex flex-col gap-2.5">
            <SummaryRow label="Tipo">
              {selectedTypeMeta ? (
                <span className={cn("text-xs font-semibold", selectedTypeMeta.colorClass)}>
                  ● {selectedTypeMeta.label}
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">Pendiente</span>
              )}
            </SummaryRow>
            <SummaryRow label="Descripción">
              <span className={cn(
                "text-xs tabular-nums",
                charCount >= 10 ? "text-green-600 dark:text-green-400" : "text-muted-foreground"
              )}>
                {charCount} car. {charCount >= 10 ? "✓" : "· mín. 10"}
              </span>
            </SummaryRow>
            {showConvField && (
              <SummaryRow label="Chat">
                {selectedConversation ? (
                  <span className="text-xs font-mono text-foreground">#{selectedConversation.id}</span>
                ) : (
                  <span className="text-xs text-muted-foreground">Pendiente</span>
                )}
              </SummaryRow>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-none hover:shadow-none hover:translate-y-0">
        <CardContent className="p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Cómo redactar mejor
          </p>
          <ul className="flex flex-col gap-2">
            {TICKET_TIPS.map((tip, i) => (
              <li key={i} className="flex gap-2 text-xs text-muted-foreground leading-relaxed">
                <span className="w-1 h-1 rounded-full bg-volt mt-1.5 shrink-0" />
                {tip}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card className="border-cielo/20 bg-cielo/5 shadow-none hover:shadow-none hover:translate-y-0">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-cielo" />
            <p className="text-xs font-semibold text-cielo">Tiempo de respuesta</p>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Críticos &lt; 2 h · Ajustes &lt; 24 h · Desarrollos &lt; 5 días.
          </p>
        </CardContent>
      </Card>

    </aside>
  )
}

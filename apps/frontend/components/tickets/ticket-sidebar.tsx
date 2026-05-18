import type { ReactNode } from "react"
import { Clock } from "lucide-react"
import { cn } from "@/lib/utils"
import { Card, CardContent } from "@/components/ui/card"
import { TICKET_TIPS, TICKET_TYPE_MAP, type TicketType } from "@/lib/constants/tickets"
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

// rendering-hoist-jsx: estos dos cards son completamente estáticos — se extraen
// para evitar recrearlos en cada render (charCount cambia con cada keystroke)
const tipsCard = (
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
)

const responseTimeCard = (
  <Card className="border-info/30 bg-info-bg shadow-none hover:shadow-none hover:translate-y-0">
    <CardContent className="p-4">
      <div className="flex items-center gap-2 mb-2">
        <Clock className="w-4 h-4 text-info" />
        <p className="text-xs font-semibold text-info">Tiempo de respuesta</p>
      </div>
      <p className="text-xs text-marino leading-relaxed">
        Críticos &lt; 2 h · Ajustes &lt; 24 h · Desarrollos &lt; 5 días.
      </p>
    </CardContent>
  </Card>
)

export function TicketSidebar({ type, charCount, selectedConversation, showConvField }: TicketSidebarProps) {
  const selectedTypeMeta = type ? TICKET_TYPE_MAP.get(type) : undefined

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
                charCount >= 10 ? "text-success" : "text-muted-foreground"
              )}>
                {charCount} car. {charCount >= 10 ? "✓" : "· mín. 10"}
              </span>
            </SummaryRow>
            {showConvField && (
              <SummaryRow label={type === "critical_incident" ? "Chat" : "Ref. chat"}>
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

      {tipsCard}
      {responseTimeCard}

    </aside>
  )
}

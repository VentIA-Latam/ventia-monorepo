"use client"

import { memo, useCallback } from "react"
import { cn } from "@/lib/utils"
import { TICKET_TYPES, type TicketType } from "@/lib/constants/tickets"

interface TicketTypeSelectorProps {
  value: TicketType | null
  onChange: (t: TicketType) => void
  touched: boolean
}

export const TicketTypeSelector = memo(function TicketTypeSelector({
  value,
  onChange,
  touched,
}: TicketTypeSelectorProps) {
  const errored = touched && !value

  const handleChange = useCallback((id: TicketType) => () => onChange(id), [onChange])

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
      {TICKET_TYPES.map(({ id, label, description: desc, Icon, colorClass, bgClass, borderClass, iconBgClass }) => {
        const selected = value === id
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={handleChange(id)}
            className={cn(
              "flex flex-col gap-3 p-4 rounded-xl border-2 text-left transition-all duration-150 min-h-[130px] outline-none focus-visible:ring-2 focus-visible:ring-ring",
              selected
                ? cn(bgClass, borderClass, "shadow-sm")
                : errored
                  ? "border-destructive bg-background hover:bg-muted/30"
                  : "border-border bg-background hover:bg-muted/30 hover:border-muted-foreground/30"
            )}
          >
            <div className="flex items-start justify-between">
              <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center", iconBgClass)}>
                <Icon className={cn("w-[18px] h-[18px]", colorClass)} />
              </div>
              <div className={cn(
                "w-4 h-4 rounded-full border-2 mt-0.5 flex-shrink-0 transition-all",
                selected ? cn(borderClass, "border-[5px]") : "border-muted-foreground/40 bg-background"
              )} />
            </div>
            <div>
              <p className="text-sm font-semibold">{label}</p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{desc}</p>
            </div>
          </button>
        )
      })}
    </div>
  )
})

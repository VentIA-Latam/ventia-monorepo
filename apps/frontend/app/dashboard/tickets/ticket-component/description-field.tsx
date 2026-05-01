"use client"

import { cn } from "@/lib/utils"
import { Textarea } from "@/components/ui/textarea"

interface DescriptionFieldProps {
  value: string
  onChange: (v: string) => void
  onBlur: () => void
  disabled: boolean
  hasError: boolean
}

export function DescriptionField({ value, onChange, onBlur, disabled, hasError }: DescriptionFieldProps) {
  const charCount = value.length

  return (
    <div className={cn(
      "rounded-xl border-2 transition-colors",
      hasError ? "border-destructive" : "border-border focus-within:border-cielo"
    )}>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        disabled={disabled}
        rows={8}
        maxLength={5000}
        placeholder="Ej. El agente respondió con un precio antiguo del catálogo cuando el cliente preguntó por el plan Pro. La conversación quedó cortada y el cliente desistió de la compra."
        className="border-0 focus-visible:ring-0 resize-y min-h-[160px] text-sm rounded-t-xl rounded-b-none bg-transparent"
      />
      <div className="px-4 py-2.5 border-t border-border/50 flex items-center gap-3">
        <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-150",
              charCount > 4500 ? "bg-destructive" : charCount >= 10 ? "bg-volt" : "bg-amber-400"
            )}
            style={{ width: `${Math.min(100, (charCount / 5000) * 100)}%` }}
          />
        </div>
        <span className={cn(
          "text-xs font-medium tabular-nums",
          charCount > 4500 ? "text-destructive" : "text-muted-foreground"
        )}>
          {charCount.toLocaleString("es-PE")} / 5,000
        </span>
      </div>
    </div>
  )
}

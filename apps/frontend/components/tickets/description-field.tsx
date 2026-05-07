"use client"

import { memo, useCallback, type ChangeEvent } from "react"
import { cn } from "@/lib/utils"
import { Textarea } from "@/components/ui/textarea"

interface DescriptionFieldProps {
  value: string
  onChange: (v: string) => void
  onBlur: () => void
  disabled: boolean
  hasError: boolean
}

export const DescriptionField = memo(function DescriptionField({
  value,
  onChange,
  onBlur,
  disabled,
  hasError,
}: DescriptionFieldProps) {
  const charCount = value.length

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>) => onChange(e.target.value),
    [onChange]
  )

  return (
    <div className={cn(
      "rounded-xl border transition-[color,box-shadow] overflow-hidden",
      hasError
        ? "border-destructive ring-destructive/20 ring-[3px]"
        : "border-input focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-[3px]"
    )}>
      <Textarea
        value={value}
        onChange={handleChange}
        onBlur={onBlur}
        disabled={disabled}
        rows={8}
        maxLength={5000}
        placeholder="Ej. El agente respondió con un precio antiguo del catálogo cuando el cliente preguntó por el plan Pro. La conversación quedó cortada y el cliente desistió de la compra."
        className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 resize-y min-h-[160px] text-sm rounded-none bg-transparent shadow-none"
      />
      <div className="px-4 py-2.5 border-t border-border/50 flex items-center gap-3">
        <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-150",
              charCount > 4500 ? "bg-destructive" : charCount >= 10 ? "bg-volt" : "bg-warning"
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
})

"use client"

import * as React from "react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { CalendarIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface DatePickerProps {
  date: Date | undefined
  onDateChange: (date: Date | undefined) => void
  placeholder?: string
  label?: string
  /** Fechas adicionales a deshabilitar (ej: { before: startDate }) */
  disabled?: { before?: Date; after?: Date }
  /** Límite superior: deshabilita días posteriores a esta fecha */
  toDate?: Date
  fromDate?: Date
  className?: string
}

export function DatePicker({
  date,
  onDateChange,
  placeholder = "Seleccionar",
  label,
  disabled,
  toDate,
  fromDate,
  className,
}: DatePickerProps) {
  // Combina el disabled externo con el bloqueo de fechas futuras (toDate)
  const disabledMatchers = [
    ...(disabled ? [disabled] : []),
    ...(toDate ? [{ after: toDate }] : []),
  ]

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      {label && (
        <span className="text-xs text-muted-foreground font-medium">{label}</span>
      )}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "h-9 min-w-[140px] justify-start gap-2 text-left font-normal",
              !date && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="h-4 w-4 shrink-0" />
            {date ? format(date, "dd/MM/yyyy", { locale: es }) : <span>{placeholder}</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={date}
            onSelect={onDateChange}
            defaultMonth={date}
            disabled={disabledMatchers}
            toDate={toDate}
            fromDate={fromDate}
            initialFocus
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}

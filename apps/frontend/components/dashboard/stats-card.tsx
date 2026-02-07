"use client"

import { useEffect, useRef } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { TrendingUp, TrendingDown } from "lucide-react"
import { useMotionValue, useSpring, useInView } from "framer-motion"

interface StatsCardProps {
  title: string
  value: string
  icon?: React.ReactNode
  badge?: string
  badgeType?: "warning" | "info" | "success"
  change?: string
  changeType?: "positive" | "negative"
  comparison?: string
  accentColor?: "volt" | "success" | "warning" | "marino" | "aqua"
}

const accentStyles: Record<string, { border: string; iconBg: string; iconText: string }> = {
  volt: {
    border: "border-l-volt",
    iconBg: "bg-volt/10",
    iconText: "text-volt",
  },
  success: {
    border: "border-l-success",
    iconBg: "bg-success-bg",
    iconText: "text-success",
  },
  warning: {
    border: "border-l-warning",
    iconBg: "bg-warning-bg",
    iconText: "text-warning",
  },
  marino: {
    border: "border-l-marino",
    iconBg: "bg-marino/10",
    iconText: "text-marino",
  },
  aqua: {
    border: "border-l-aqua",
    iconBg: "bg-aqua/10",
    iconText: "text-aqua",
  },
}

function AnimatedNumber({ value }: { value: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const isInView = useInView(ref, { once: true })

  const numericMatch = value.match(/[\d,.]+/)
  const numericStr = numericMatch ? numericMatch[0].replace(/,/g, "") : null
  const numericValue = numericStr ? parseFloat(numericStr) : null
  const prefix = numericMatch ? value.slice(0, numericMatch.index) : ""
  const suffix = numericMatch ? value.slice((numericMatch.index || 0) + numericMatch[0].length) : ""
  const hasDecimals = numericStr?.includes(".") ?? false

  const motionVal = useMotionValue(0)
  const spring = useSpring(motionVal, { stiffness: 80, damping: 20 })

  useEffect(() => {
    if (isInView && numericValue !== null) {
      motionVal.set(numericValue)
    }
  }, [isInView, numericValue, motionVal])

  useEffect(() => {
    const unsubscribe = spring.on("change", (latest) => {
      if (ref.current && numericValue !== null) {
        const formatted = numericValue >= 1000
          ? latest.toLocaleString("es-ES", {
              minimumFractionDigits: hasDecimals ? 2 : 0,
              maximumFractionDigits: hasDecimals ? 2 : 0,
            })
          : hasDecimals
            ? latest.toFixed(2)
            : Math.round(latest).toString()
        ref.current.textContent = `${prefix}${formatted}${suffix}`
      }
    })
    return unsubscribe
  }, [spring, prefix, suffix, numericValue, hasDecimals])

  if (numericValue === null) {
    return <span ref={ref}>{value}</span>
  }

  return <span ref={ref}>{prefix}0{suffix}</span>
}

export function StatsCard({
  title,
  value,
  icon,
  badge,
  badgeType = "info",
  change,
  changeType = "positive",
  comparison,
  accentColor = "volt",
}: StatsCardProps) {
  const accent = accentStyles[accentColor]

  return (
    <Card className={cn(
      "border-l-[3px] hover:shadow-md",
      accent.border
    )}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2 flex-1 min-w-0">
            <p className="text-sm font-medium text-muted-foreground truncate">
              {title}
            </p>
            <div className="text-3xl font-bold text-foreground font-mono tabular-nums">
              <AnimatedNumber value={value} />
            </div>
          </div>

          {icon && (
            <div className={cn(
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
              accent.iconBg
            )}>
              <div className={accent.iconText}>
                {icon}
              </div>
            </div>
          )}
        </div>

        {(badge || change || comparison) && (
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            {badge && (
              <Badge variant={badgeType} className="text-xs">
                {badge}
              </Badge>
            )}

            {change && (
              <div className="flex items-center gap-1 text-sm">
                {changeType === "positive" ? (
                  <TrendingUp className="h-3.5 w-3.5 text-success" />
                ) : (
                  <TrendingDown className="h-3.5 w-3.5 text-danger" />
                )}
                <span className={cn(
                  "font-semibold text-xs",
                  changeType === "positive" ? "text-success" : "text-danger"
                )}>
                  {change}
                </span>
              </div>
            )}

            {comparison && !change && (
              <p className="text-xs text-muted-foreground">{comparison}</p>
            )}
            {comparison && change && (
              <span className="text-xs text-muted-foreground">{comparison}</span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

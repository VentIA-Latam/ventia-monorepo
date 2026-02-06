import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface StatsCardProps {
  title: string
  value: string
  icon?: React.ReactNode
  badge?: string
  badgeType?: "warning" | "info" | "success"
  change?: string
  changeType?: "positive" | "negative"
  comparison?: string
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
}: StatsCardProps) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <div className="space-y-1">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {title}
          </CardTitle>
        </div>
        {icon && (
          <div className="text-2xl opacity-80">
            {icon}
          </div>
        )}
      </CardHeader>

      <CardContent>
        <div className="text-3xl font-bold text-foreground font-mono tabular-nums">
          {value}
        </div>

        {badge && (
          <Badge
            variant="outline"
            className={cn(
              "mt-3 text-xs",
              {
                "bg-warning-bg text-warning border-warning/30": badgeType === "warning",
                "bg-info-bg text-info border-info/30": badgeType === "info",
                "bg-success-bg text-success border-success/30": badgeType === "success",
              }
            )}
          >
            {badge}
          </Badge>
        )}

        {change && (
          <div className="mt-3 flex items-center text-sm">
            <span className={cn(
              "font-semibold",
              {
                "text-success": changeType === "positive",
                "text-danger": changeType === "negative",
              }
            )}>
              {change}
            </span>
            {comparison && (
              <span className="ml-1 text-muted-foreground">
                {comparison}
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

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
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <div className="space-y-1">
          <CardTitle className="text-sm font-medium text-gray-600">
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
        <div className="text-3xl font-bold text-gray-900">
          {value}
        </div>

        {badge && (
          <Badge
            variant="outline"
            className={cn(
              "mt-3 text-xs",
              {
                "bg-orange-50 text-orange-700 border-orange-200": badgeType === "warning",
                "bg-blue-50 text-blue-700 border-blue-200": badgeType === "info",
                "bg-green-50 text-green-700 border-green-200": badgeType === "success",
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
                "text-green-600": changeType === "positive",
                "text-red-600": changeType === "negative",
              }
            )}>
              {change}
            </span>
            {comparison && (
              <span className="ml-1 text-gray-500">
                {comparison}
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

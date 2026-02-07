import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground shadow hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground shadow hover:bg-destructive/80",
        outline: "text-foreground",
        success:
          "border-success/30 bg-success-bg text-success shadow-[0_0_8px_-2px_oklch(0.59_0.18_145/0.2)]",
        warning:
          "border-warning/30 bg-warning-bg text-warning shadow-[0_0_8px_-2px_oklch(0.62_0.17_70/0.2)]",
        danger:
          "border-danger/30 bg-danger-bg text-danger shadow-[0_0_8px_-2px_oklch(0.55_0.22_27/0.2)]",
        info:
          "border-info/30 bg-info-bg text-info shadow-[0_0_8px_-2px_oklch(0.78_0.11_220/0.2)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  dot?: boolean
}

function Badge({ className, variant, dot, children, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props}>
      {dot && (
        <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
      )}
      {children}
    </div>
  )
}

export { Badge, badgeVariants }

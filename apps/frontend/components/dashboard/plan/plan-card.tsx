import { Check, Star } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { Plan } from "./plan-data"

interface PlanCardProps {
  plan: Plan
  onChoose: (id: string) => void
}

export function PlanCard({ plan, onChoose }: PlanCardProps) {
  return (
    <div
      className={cn(
        "relative flex flex-col rounded-xl border bg-card p-6 gap-5 transition-shadow",
        plan.popular
          ? "border-volt shadow-[0_0_0_1px_theme(colors.volt),0_18px_40px_-22px_rgba(41,171,226,0.35)]"
          : "border-border shadow-sm hover:shadow-md"
      )}
    >
      {plan.popular && (
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
          <span className="inline-flex items-center gap-1.5 bg-volt text-white text-[10px] font-semibold tracking-widest uppercase px-3 py-1 rounded-full shadow-md whitespace-nowrap">
            <Star className="w-3 h-3 fill-white stroke-none" />
            Más popular
          </span>
        </div>
      )}

      <div className={cn("mt-1", plan.popular && "mt-2")}>
        <p className="text-[10px] font-semibold tracking-[0.18em] uppercase text-muted-foreground mb-1">
          Plan
        </p>
        <h3 className="text-xl font-bold text-foreground font-heading">{plan.name}</h3>
        <p className="text-sm text-muted-foreground mt-1">{plan.tagline}</p>
      </div>

      <div className="flex items-baseline gap-1.5">
        <span className="text-xs font-semibold text-muted-foreground">USD</span>
        <span className="text-5xl font-extrabold text-foreground font-heading leading-none tracking-tight">
          {plan.price}
        </span>
        <span className="text-sm text-muted-foreground">/ mes + IGV</span>
      </div>

      <div className="border-t border-border/60" />

      <ul className="flex flex-col gap-2.5 flex-1">
        {plan.features.map((feature) => (
          <li key={feature} className="flex items-start gap-2 text-sm text-foreground">
            <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-volt/10 text-volt">
              <Check className="w-2.5 h-2.5" strokeWidth={3} />
            </span>
            {feature}
          </li>
        ))}
      </ul>

      <Button
        variant={plan.popular ? "default" : "outline"}
        className={cn(
          "w-full font-semibold",
          plan.popular && "bg-volt hover:bg-volt/90 text-white shadow-md shadow-volt/30"
        )}
        onClick={() => onChoose(plan.id)}
      >
        Elegir {plan.name} ›
      </Button>
    </div>
  )
}

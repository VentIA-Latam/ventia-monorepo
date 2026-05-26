import { Shield, Lock, Sparkles } from "lucide-react"
import { PlanCard } from "./plan-card"
import { PLANS } from "./plan-data"

interface PlanCardsProps {
  onChoose: (planId: string) => void
}

export function PlanCards({ onChoose }: PlanCardsProps) {
  return (
    <div className="space-y-8">
      <div>
        <p className="text-[11px] font-semibold tracking-[0.14em] uppercase text-volt mb-1.5">
          Plan & Facturación
        </p>
        <h1 className="text-3xl font-bold text-foreground font-heading tracking-tight">
          Elige tu plan
        </h1>
        <p className="text-muted-foreground mt-2 max-w-xl text-sm">
          Selecciona el plan que mejor se adapte a tu negocio. Puedes cambiar de plan cuando
          quieras — solo pagas la diferencia.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 pt-3">
        {PLANS.map((plan) => (
          <PlanCard key={plan.id} plan={plan} onChoose={onChoose} />
        ))}
      </div>

      <div className="flex flex-wrap justify-center gap-6 pt-2">
        {[
          { icon: Shield, text: "Sin contratos. Cancela cuando quieras." },
          { icon: Lock, text: "Pago seguro · facturación electrónica SUNAT." },
          { icon: Sparkles, text: "Cambia de plan en 1 clic — solo pagas la diferencia." },
        ].map(({ icon: Icon, text }) => (
          <div key={text} className="flex items-center gap-2 text-xs text-muted-foreground">
            <Icon className="w-3.5 h-3.5 text-muted-foreground/70" />
            {text}
          </div>
        ))}
      </div>
    </div>
  )
}

"use client"

import { useState } from "react"
import { ArrowLeft, CreditCard, Receipt, Lock, Shield, Sparkles, Check, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { PLANS } from "./plan-data"

interface PlanCheckoutProps {
  planId: string
  onBack: () => void
}

function detectBrand(n: string) {
  const c = n.replace(/\s/g, "")
  if (/^4/.test(c)) return "VISA"
  if (/^5[1-5]/.test(c)) return "MC"
  if (/^3[47]/.test(c)) return "AMEX"
  return null
}

function formatCardNumber(v: string) {
  return v.replace(/\D/g, "").slice(0, 16).replace(/(.{4})/g, "$1 ").trim()
}

function formatExp(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 4)
  return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d
}

export function PlanCheckout({ planId, onBack }: PlanCheckoutProps) {
  const plan = PLANS.find((p) => p.id === planId) ?? PLANS[1]

  const [cardNumber, setCardNumber] = useState("")
  const [cardName, setCardName] = useState("")
  const [exp, setExp] = useState("")
  const [cvv, setCvv] = useState("")
  const [confirmed, setConfirmed] = useState(false)

  const brand = detectBrand(cardNumber)
  const subtotal = plan.price
  const igv = +(subtotal * 0.18).toFixed(2)
  const total = +(subtotal + igv).toFixed(2)

  const isFormComplete =
    cardName.trim().length > 0 &&
    cardNumber.replace(/\s/g, "").length === 16 &&
    exp.length === 5 &&
    cvv.length >= 3

  if (confirmed) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6">
        <div className="w-20 h-20 rounded-full bg-volt/10 flex items-center justify-center">
          <CheckCircle2 className="w-10 h-10 text-volt" />
        </div>

        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-foreground font-heading tracking-tight">
            ¡Suscripción activada!
          </h1>
          <p className="text-muted-foreground max-w-sm">
            Tu plan <strong className="text-foreground">{plan.name}</strong> ha sido activado
            exitosamente. Tu agente ya está operando 24/7.
          </p>
        </div>

        <div className="bg-volt/5 border border-volt/20 rounded-xl px-6 py-4 space-y-2 w-full max-w-xs text-left">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Plan</span>
            <span className="font-semibold text-foreground">{plan.name}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="font-mono text-foreground">USD {subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">IGV (18%)</span>
            <span className="font-mono text-muted-foreground">USD {igv.toFixed(2)}</span>
          </div>
          <div className="border-t border-volt/20 pt-2 flex justify-between text-sm font-bold">
            <span className="text-foreground">Total cobrado</span>
            <span className="font-mono text-volt">USD {total.toFixed(2)}</span>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Se enviará una factura electrónica SUNAT al RUC registrado.
        </p>

        <Button onClick={onBack} variant="outline" className="mt-2">
          Volver a planes
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="-ml-2 mb-3 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          Volver a planes
        </Button>
        <h1 className="text-2xl font-bold text-foreground font-heading tracking-tight">
          Completa tu suscripción
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Estás a un paso de activar el plan{" "}
          <strong className="text-foreground">{plan.name}</strong>. Tu agente comenzará a
          operar 24/7 inmediatamente después de la confirmación.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6 items-start">
        {/* LEFT: Form */}
        <div className="flex flex-col gap-6 bg-card border border-border rounded-xl p-6">
          {/* Datos de la tarjeta */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <CreditCard className="w-4 h-4 text-volt" />
              <h2 className="text-sm font-semibold text-foreground">Datos de la tarjeta</h2>
            </div>
            <p className="text-xs text-muted-foreground mb-4">
              Aceptamos Visa, Mastercard y American Express.
            </p>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="cardName">Nombre en la tarjeta</Label>
                <Input
                  id="cardName"
                  placeholder="RENZO LENES"
                  value={cardName}
                  onChange={(e) => setCardName(e.target.value.toUpperCase())}
                  className="uppercase tracking-wide"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="cardNumber">Número de tarjeta</Label>
                <div className="relative">
                  <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                  <Input
                    id="cardNumber"
                    placeholder="1234 5678 9012 3456"
                    value={cardNumber}
                    onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                    inputMode="numeric"
                    className="pl-9 pr-16 font-mono"
                  />
                  {brand && (
                    <span
                      className={cn(
                        "absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold px-2 py-0.5 rounded text-white",
                        brand === "VISA" && "bg-[#1a1f71]",
                        brand === "MC" && "bg-[#eb001b]",
                        brand === "AMEX" && "bg-[#006fcf]"
                      )}
                    >
                      {brand}
                    </span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="exp">Vencimiento</Label>
                  <Input
                    id="exp"
                    placeholder="MM/AA"
                    value={exp}
                    onChange={(e) => setExp(formatExp(e.target.value))}
                    inputMode="numeric"
                    className="font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cvv">CVV</Label>
                  <Input
                    id="cvv"
                    type="password"
                    placeholder="•••"
                    value={cvv}
                    onChange={(e) => setCvv(e.target.value.replace(/\D/g, "").slice(0, 4))}
                    inputMode="numeric"
                    className="font-mono"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-border/60" />

          {/* Datos de facturación */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Receipt className="w-4 h-4 text-volt" />
              <h2 className="text-sm font-semibold text-foreground">Datos de facturación</h2>
            </div>
            <p className="text-xs text-muted-foreground mb-4">
              Emitimos boleta o factura electrónica SUNAT a este RUC.
            </p>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="razonSocial">Razón social</Label>
                <Input id="razonSocial" placeholder="Mi Empresa S.A.C." />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="ruc">RUC</Label>
                  <Input
                    id="ruc"
                    placeholder="20XXXXXXXXX"
                    inputMode="numeric"
                    maxLength={11}
                    className="font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="direccion">Dirección fiscal</Label>
                  <Input id="direccion" placeholder="Dirección de tu empresa" />
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-border/60" />

          {/* CTA */}
          <div className="space-y-3">
            <Button
              disabled={!isFormComplete}
              onClick={() => setConfirmed(true)}
              className={cn(
                "w-full font-semibold transition-opacity",
                isFormComplete
                  ? "bg-volt hover:bg-volt/90 text-white shadow-md shadow-volt/30"
                  : "bg-volt/50 text-white cursor-not-allowed"
              )}
            >
              <Lock className="w-4 h-4 mr-2" />
              Confirmar suscripción · USD {total.toFixed(2)}
            </Button>
            <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
              <Lock className="w-3 h-3" />
              Pago seguro · Sin cargos reales en este mockup
            </div>
          </div>
        </div>

        {/* RIGHT: Plan summary */}
        <div className="sticky top-6 space-y-4">
          <div className="rounded-xl border border-volt shadow-[0_0_0_1px_theme(colors.volt),0_18px_40px_-22px_rgba(41,171,226,0.35)] overflow-hidden">
            <div className="bg-volt/5 border-b border-volt/20 px-5 py-4">
              <p className="text-[10px] font-semibold tracking-[0.18em] uppercase text-volt mb-1">
                Tu plan
              </p>
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="text-xl font-bold text-foreground font-heading">
                  Plan {plan.name}
                </h3>
                {plan.popular && (
                  <span className="inline-flex items-center gap-1 bg-volt text-white text-[9px] font-semibold tracking-widest uppercase px-2 py-0.5 rounded-full whitespace-nowrap">
                    Popular
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">{plan.tagline}</p>
            </div>

            <div className="px-5 py-4 border-b border-dashed border-border space-y-2.5">
              {plan.features.map((f) => (
                <div key={f} className="flex items-start gap-2 text-sm">
                  <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-volt/10 text-volt">
                    <Check className="w-2.5 h-2.5" strokeWidth={3} />
                  </span>
                  {f}
                </div>
              ))}
            </div>

            <div className="px-5 py-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal · {plan.name}</span>
                <span className="font-mono text-foreground">USD {subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">IGV (18%)</span>
                <span className="font-mono text-muted-foreground">USD {igv.toFixed(2)}</span>
              </div>
              <div className="border-t border-border/60 pt-2">
                <div className="flex justify-between items-baseline">
                  <span className="text-sm font-semibold text-foreground">Total mensual</span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-xs font-semibold text-muted-foreground">USD</span>
                    <span className="text-2xl font-extrabold text-foreground font-heading leading-none tracking-tight">
                      {total.toFixed(2)}
                    </span>
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground text-right mt-0.5">
                  Cobro recurrente cada mes hasta cancelación
                </p>
              </div>
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl px-4 py-3 space-y-3">
            {[
              { icon: Shield, title: "Cancela cuando quieras", desc: "Sin contratos ni penalidades." },
              { icon: Sparkles, title: "Cambia de plan en 1 clic", desc: "Prorrateamos automáticamente." },
              { icon: Receipt, title: "Factura electrónica", desc: "Emitida automáticamente vía SUNAT." },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-lg bg-volt/10 flex items-center justify-center shrink-0">
                  <Icon className="w-3.5 h-3.5 text-volt" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-foreground">{title}</p>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import { AlertTriangle, Sliders, Sparkles, MessageSquare, ChevronDown, Search, Check, Clock, Send, RefreshCw } from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { getConversations } from "@/lib/api-client/messaging"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import type { Conversation } from "@/lib/types/messaging"

type TicketType = "critical_incident" | "agent_adjustment" | "additional_development"

const TICKET_TYPES = [
  {
    id: "critical_incident" as TicketType,
    label: "Incidencia Crítica",
    description: "Errores o fallas del agente que afectan operación inmediata",
    Icon: AlertTriangle,
    colorClass: "text-red-500",
    bgClass: "bg-red-50 dark:bg-red-950/20",
    borderClass: "border-red-400 dark:border-red-600",
    iconBgClass: "bg-red-100 dark:bg-red-900/30",
  },
  {
    id: "agent_adjustment" as TicketType,
    label: "Ajuste al Agente",
    description: "Cambios menores de comportamiento o contenido",
    Icon: Sliders,
    colorClass: "text-cielo",
    bgClass: "bg-cielo/5",
    borderClass: "border-cielo/60",
    iconBgClass: "bg-cielo/10",
  },
  {
    id: "additional_development" as TicketType,
    label: "Desarrollo Adicional",
    description: "Mejoras o cambios estructurales profundos",
    Icon: Sparkles,
    colorClass: "text-violet-500",
    bgClass: "bg-violet-50 dark:bg-violet-950/20",
    borderClass: "border-violet-400 dark:border-violet-600",
    iconBgClass: "bg-violet-100 dark:bg-violet-900/30",
  },
]

const N8N_WEBHOOK_URL = "https://n8n.ventia-latam.com/webhook/clickup-test"

export function NewTicketClient() {
  const { userDetails, isUserLoading } = useAuth()
  const { toast } = useToast()

  const [type, setType] = useState<TicketType | null>(null)
  const [description, setDescription] = useState("")
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [convSearch, setConvSearch] = useState("")
  const [loadingConvs, setLoadingConvs] = useState(false)
  const [convOpen, setConvOpen] = useState(false)
  const [touched, setTouched] = useState({ type: false, description: false, conversation: false })
  const [submitting, setSubmitting] = useState(false)
  const [serverError, setServerError] = useState(false)

  const convDropdownRef = useRef<HTMLDivElement>(null)
  const convTriggerRef = useRef<HTMLButtonElement>(null)
  const typeRef = useRef<HTMLDivElement>(null)
  const descRef = useRef<HTMLDivElement>(null)
  const convRef = useRef<HTMLDivElement>(null)

  // Load/search conversations whenever type is critical_incident or search changes
  useEffect(() => {
    if (type !== "critical_incident") return
    const controller = new AbortController()
    const load = async () => {
      setLoadingConvs(true)
      try {
        const res = await getConversations({ search: convSearch }, controller.signal)
        if (!controller.signal.aborted) {
          setConversations(res.data)
        }
      } catch {
        if (!controller.signal.aborted) setConversations([])
      } finally {
        if (!controller.signal.aborted) setLoadingConvs(false)
      }
    }
    load()
    return () => controller.abort()
  }, [type, convSearch])

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        convOpen &&
        convDropdownRef.current &&
        !convDropdownRef.current.contains(e.target as Node) &&
        convTriggerRef.current &&
        !convTriggerRef.current.contains(e.target as Node)
      ) {
        setConvOpen(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [convOpen])

  const errors = useMemo(() => {
    const e: Partial<Record<"type" | "description" | "conversation", string>> = {}
    if (!type) e.type = "Selecciona un tipo de ticket"
    if (!description.trim()) e.description = "La descripción es requerida"
    else if (description.trim().length < 10) e.description = "Mínimo 10 caracteres"
    else if (description.length > 5000) e.description = "Máximo 5000 caracteres"
    if (type === "critical_incident" && !selectedConversation) e.conversation = "Selecciona una conversación"
    return e
  }, [type, description, selectedConversation])

  const isValid = Object.keys(errors).length === 0
  const charCount = description.length

  const resetForm = () => {
    setType(null)
    setDescription("")
    setSelectedConversation(null)
    setConvSearch("")
    setTouched({ type: false, description: false, conversation: false })
    setServerError(false)
  }

  const handleSubmit = async () => {
    setTouched({ type: true, description: true, conversation: true })
    if (!isValid) {
      if (errors.type) typeRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
      else if (errors.description) descRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
      else if (errors.conversation) convRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
      return
    }

    if (!userDetails) return

    const payload: Record<string, unknown> = {
      type,
      description: description.trim(),
      user: {
        email: userDetails.email,
        name: userDetails.name,
        tenant_id: userDetails.tenant_id,
      },
    }

    if (type === "critical_incident" && selectedConversation) {
      payload.conversation_id = selectedConversation.id
      payload.contact = {
        id: selectedConversation.contact?.id,
        name: selectedConversation.contact?.name,
        phone_number: selectedConversation.contact?.phone_number,
        email: selectedConversation.contact?.email,
        last_activity_at: selectedConversation.contact?.last_activity_at,
      }
      payload.inbox = {
        id: selectedConversation.inbox?.id,
        name: selectedConversation.inbox?.name,
        channel_type: selectedConversation.inbox?.channel_type,
      }
    }

    setSubmitting(true)
    setServerError(false)

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10_000)

      const res = await fetch(N8N_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      toast({ description: "✓ Ticket enviado. El equipo de soporte te contactará pronto." })
      resetForm()
    } catch {
      setServerError(true)
      toast({ variant: "destructive", description: "Error al enviar el ticket. Intenta nuevamente." })
    } finally {
      setSubmitting(false)
    }
  }

  const handleTypeSelect = (t: TicketType) => {
    setType(t)
    setTouched((p) => ({ ...p, type: true }))
    if (t !== "critical_incident") {
      setSelectedConversation(null)
      setConvSearch("")
    }
  }

  const getConvLabel = (conv: Conversation) => {
    const name = conv.contact?.name ?? "Sin nombre"
    const phone = conv.contact?.phone_number
    return phone ? `${name} - ${phone}` : name
  }

  const showConvField = type === "critical_incident"
  const selectedTypeMeta = TICKET_TYPES.find((t) => t.id === type)

  return (
    <div className="flex flex-col gap-6">
      {/* Page header */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">
          Soporte VentIA · Reportar un ticket
        </p>
        <h1 className="text-2xl font-bold tracking-tight">Reportar un ticket</h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl leading-relaxed">
          Cuéntanos qué pasó con tu agente de IA: incidencias, ajustes o ideas de desarrollo.
          Nuestro equipo responde en menos de 24 horas hábiles.
        </p>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6 items-start">

        {/* ── Main form column ── */}
        <div className="flex flex-col gap-8">

          {/* Field 1: Ticket type */}
          <div ref={typeRef}>
            <FieldLabel step={1} label="Tipo de ticket" required />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
              {TICKET_TYPES.map(({ id, label, description: desc, Icon, colorClass, bgClass, borderClass, iconBgClass }) => {
                const selected = type === id
                const errored = touched.type && !type
                return (
                  <button
                    key={id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => handleTypeSelect(id)}
                    className={cn(
                      "flex flex-col gap-3 p-4 rounded-xl border-2 text-left transition-all duration-150 min-h-[130px] outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      selected
                        ? cn(bgClass, borderClass, "shadow-sm")
                        : errored
                          ? "border-destructive bg-background hover:bg-muted/30"
                          : "border-border bg-background hover:bg-muted/30 hover:border-muted-foreground/30"
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center", iconBgClass)}>
                        <Icon className={cn("w-[18px] h-[18px]", colorClass)} />
                      </div>
                      <div className={cn(
                        "w-4 h-4 rounded-full border-2 mt-0.5 flex-shrink-0 transition-all",
                        selected ? cn(borderClass, "border-[5px]") : "border-muted-foreground/40 bg-background"
                      )} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{desc}</p>
                    </div>
                  </button>
                )
              })}
            </div>
            {touched.type && errors.type && <FieldError message={errors.type} />}
          </div>

          {/* Field 2: Description */}
          <div ref={descRef}>
            <FieldLabel step={2} label="Descripción" required />
            <p className="text-xs text-muted-foreground mt-1 mb-2">
              Describe qué ocurrió, cuándo y qué esperabas. Mínimo 10 caracteres.
            </p>
            <div className={cn(
              "rounded-xl border-2 transition-colors",
              touched.description && errors.description
                ? "border-destructive"
                : "border-border focus-within:border-cielo"
            )}>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onBlur={() => setTouched((p) => ({ ...p, description: true }))}
                disabled={submitting}
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
                      charCount > 4500
                        ? "bg-destructive"
                        : charCount >= 10
                          ? "bg-volt"
                          : "bg-amber-400"
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
            {touched.description && errors.description && <FieldError message={errors.description} />}
          </div>

          {/* Field 3: Conversation selector (conditional) */}
          {showConvField && (
            <div ref={convRef}>
              <FieldLabel step={3} label="Chat asociado" required />
              <p className="text-xs text-muted-foreground mt-1 mb-2">
                Selecciona la conversación donde ocurrió el problema.
              </p>

              <div className="relative">
                {/* Trigger */}
                <button
                  ref={convTriggerRef}
                  type="button"
                  aria-expanded={convOpen}
                  aria-haspopup="listbox"
                  onClick={() => {
                    setConvOpen((o) => !o)
                    setTouched((p) => ({ ...p, conversation: true }))
                  }}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-colors",
                    touched.conversation && errors.conversation
                      ? "border-destructive"
                      : "border-border hover:border-muted-foreground/40"
                  )}
                >
                  <MessageSquare className="w-4 h-4 text-muted-foreground shrink-0" />
                  {selectedConversation ? (
                    <span className="flex-1 text-sm font-medium truncate">
                      {getConvLabel(selectedConversation)}
                    </span>
                  ) : (
                    <span className="flex-1 text-sm text-muted-foreground">
                      Selecciona una conversación reciente...
                    </span>
                  )}
                  <ChevronDown className={cn(
                    "w-4 h-4 text-muted-foreground shrink-0 transition-transform duration-150",
                    convOpen && "rotate-180"
                  )} />
                </button>

                {/* Dropdown */}
                {convOpen && (
                  <div
                    ref={convDropdownRef}
                    role="listbox"
                    className="absolute top-[calc(100%+6px)] left-0 right-0 bg-background border border-border rounded-xl shadow-lg z-30 flex flex-col overflow-hidden max-h-80"
                  >
                    {/* Search input */}
                    <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border">
                      <Search className="w-4 h-4 text-muted-foreground shrink-0" />
                      <input
                        autoFocus
                        value={convSearch}
                        onChange={(e) => setConvSearch(e.target.value)}
                        placeholder="Buscar por nombre o teléfono..."
                        className="flex-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground"
                      />
                    </div>

                    {/* Results */}
                    <div className="overflow-y-auto flex-1">
                      {loadingConvs ? (
                        <div className="flex flex-col gap-2 p-3">
                          {[0, 1, 2].map((i) => (
                            <div key={i} className="h-12 rounded-lg bg-muted animate-pulse" />
                          ))}
                        </div>
                      ) : conversations.length === 0 ? (
                        <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                          No hay conversaciones recientes. Completa la descripción con detalles del problema.
                        </div>
                      ) : (
                        conversations.map((conv) => {
                          const isSelected = selectedConversation?.id === conv.id
                          return (
                            <button
                              key={conv.id}
                              type="button"
                              role="option"
                              aria-selected={isSelected}
                              onClick={() => {
                                setSelectedConversation(conv)
                                setConvOpen(false)
                                setConvSearch("")
                                setTouched((p) => ({ ...p, conversation: true }))
                              }}
                              className={cn(
                                "w-full flex items-center gap-3 px-4 py-3 text-left text-sm border-b border-border/50 last:border-0 transition-colors",
                                isSelected ? "bg-cielo/10" : "hover:bg-muted/50"
                              )}
                            >
                              <div className="w-7 h-7 rounded-lg bg-cielo/10 flex items-center justify-center shrink-0">
                                <MessageSquare className="w-3.5 h-3.5 text-cielo" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium truncate">{getConvLabel(conv)}</p>
                                <p className="text-xs text-muted-foreground font-mono">#{conv.id}</p>
                              </div>
                              {isSelected && <Check className="w-4 h-4 text-cielo shrink-0" />}
                            </button>
                          )
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>

              {touched.conversation && errors.conversation && <FieldError message={errors.conversation} />}
            </div>
          )}

          {/* Server error alert */}
          {serverError && (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-destructive/5 border border-destructive/20">
              <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-destructive">No pudimos enviar el ticket</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Hubo un error de red. Tus datos se mantienen — vuelve a intentar.
                </p>
              </div>
              <Button size="sm" variant="destructive" onClick={handleSubmit} disabled={submitting}>
                <RefreshCw className="w-3 h-3 mr-1" />
                Reintentar
              </Button>
            </div>
          )}

          {/* Submit bar */}
          <div className="flex items-center justify-between pt-2 border-t border-border">
            <span className="text-xs text-muted-foreground">
              {isValid ? "Listo para enviar." : "Completa los campos requeridos para continuar."}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                disabled={submitting}
                onClick={resetForm}
              >
                Limpiar
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={submitting || isUserLoading}
                className="gap-2"
              >
                {submitting ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    Enviar Ticket
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* ── Right rail: summary + tips ── */}
        <aside className="lg:sticky lg:top-6 flex flex-col gap-4">

          {/* Summary card */}
          <div className="rounded-xl border border-border p-4 bg-muted/20">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Resumen
            </p>
            <div className="flex flex-col gap-2.5">
              <SummaryRow label="Tipo">
                {selectedTypeMeta ? (
                  <span className={cn("text-xs font-semibold", selectedTypeMeta.colorClass)}>
                    ● {selectedTypeMeta.label}
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">Pendiente</span>
                )}
              </SummaryRow>
              <SummaryRow label="Descripción">
                <span className={cn(
                  "text-xs tabular-nums",
                  charCount >= 10 ? "text-green-600 dark:text-green-400" : "text-muted-foreground"
                )}>
                  {charCount} car. {charCount >= 10 ? "✓" : "· mín. 10"}
                </span>
              </SummaryRow>
              {showConvField && (
                <SummaryRow label="Chat">
                  {selectedConversation ? (
                    <span className="text-xs font-mono text-foreground">#{selectedConversation.id}</span>
                  ) : (
                    <span className="text-xs text-muted-foreground">Pendiente</span>
                  )}
                </SummaryRow>
              )}
            </div>
          </div>

          {/* Tips card */}
          <div className="rounded-xl border border-border p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Cómo redactar mejor
            </p>
            <ul className="flex flex-col gap-2">
              {[
                "Indica fecha y hora aproximada del incidente.",
                "Adjunta el ID del chat si está disponible.",
                "Describe qué esperabas vs. qué ocurrió.",
                "Si es bug, incluye pasos para reproducir.",
              ].map((tip, i) => (
                <li key={i} className="flex gap-2 text-xs text-muted-foreground leading-relaxed">
                  <span className="w-1 h-1 rounded-full bg-volt mt-1.5 shrink-0" />
                  {tip}
                </li>
              ))}
            </ul>
          </div>

          {/* Response times */}
          <div className="rounded-xl border border-cielo/20 bg-cielo/5 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-cielo" />
              <p className="text-xs font-semibold text-cielo">Tiempo de respuesta</p>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Críticos &lt; 2 h · Ajustes &lt; 24 h · Desarrollos &lt; 5 días.
            </p>
          </div>
        </aside>
      </div>
    </div>
  )
}

function FieldLabel({ step, label, required }: { step: number; label: string; required?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span className="inline-flex items-center justify-center w-[22px] h-[22px] rounded-full bg-foreground text-background text-[11px] font-bold shrink-0">
        {step}
      </span>
      <span className="text-sm font-semibold">{label}</span>
      {required && <span className="text-xs text-muted-foreground">requerido</span>}
    </div>
  )
}

function FieldError({ message }: { message: string }) {
  return (
    <p role="alert" className="text-xs text-destructive mt-2 flex items-center gap-1.5 font-medium">
      <AlertTriangle className="w-3 h-3 shrink-0" />
      {message}
    </p>
  )
}

function SummaryRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs text-muted-foreground font-medium">{label}</span>
      <span>{children}</span>
    </div>
  )
}

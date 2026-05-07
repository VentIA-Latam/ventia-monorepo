"use client"

import { useState, useEffect, useRef, useMemo, useTransition } from "react"
import type { ChangeEvent } from "react"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { getConversations } from "@/lib/api-client/messaging"
import type { Conversation } from "@/lib/types/messaging"
import { TICKET_TYPE_MAP, N8N_WEBHOOK_URL, type TicketType } from "@/lib/constants/tickets"

export function useTicketForm() {
  const { userDetails, isUserLoading } = useAuth()
  const { toast } = useToast()

  const [type, setType] = useState<TicketType | null>(null)
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [convSearch, setConvSearch] = useState("")
  const [loadingConvs, setLoadingConvs] = useState(false)
  const [convOpen, setConvOpen] = useState(false)
  const [touched, setTouched] = useState({ type: false, title: false, description: false, conversation: false })
  const [isPending, startTransition] = useTransition()
  const [serverError, setServerError] = useState(false)
  const [files, setFiles] = useState<File[]>([])

  const convDropdownRef = useRef<HTMLDivElement>(null)
  const convTriggerRef = useRef<HTMLButtonElement>(null)
  const typeRef = useRef<HTMLDivElement>(null)
  const titleRef = useRef<HTMLDivElement>(null)
  const descRef = useRef<HTMLDivElement>(null)
  const convRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (type !== "critical_incident") return
    const controller = new AbortController()
    const load = async () => {
      setLoadingConvs(true)
      try {
        const res = await getConversations({ search: convSearch }, controller.signal)
        if (!controller.signal.aborted) setConversations(res.data)
      } catch {
        if (!controller.signal.aborted) setConversations([])
      } finally {
        if (!controller.signal.aborted) setLoadingConvs(false)
      }
    }
    load()
    return () => controller.abort()
  }, [type, convSearch])

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
    document.addEventListener("mousedown", handler, { passive: true })
    return () => document.removeEventListener("mousedown", handler)
  }, [convOpen])

  const errors = useMemo(() => {
    const e: Partial<Record<"type" | "title" | "description" | "conversation", string>> = {}
    if (!type) e.type = "Selecciona un tipo de ticket"
    if (!title.trim()) e.title = "El título es requerido"
    else if (title.length > 100) e.title = "Máximo 100 caracteres"
    if (!description.trim()) e.description = "La descripción es requerida"
    else if (description.trim().length < 10) e.description = "Mínimo 10 caracteres"
    else if (description.length > 5000) e.description = "Máximo 5000 caracteres"
    if (type === "critical_incident" && !selectedConversation) e.conversation = "Selecciona una conversación"
    return e
  }, [type, title, description, selectedConversation])

  const isValid = Object.keys(errors).length === 0
  const charCount = description.length
  const showConvField = type === "critical_incident"

  const resetForm = () => {
    setType(null)
    setTitle("")
    setDescription("")
    setSelectedConversation(null)
    setConvSearch("")
    setTouched({ type: false, title: false, description: false, conversation: false })
    setServerError(false)
    setFiles([])
  }

  const handleSubmit = () => {
    setTouched({ type: true, title: true, description: true, conversation: true })
    if (!isValid) {
      if (errors.type) typeRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
      else if (errors.title) titleRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
      else if (errors.description) descRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
      else if (errors.conversation) convRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
      return
    }

    if (!userDetails) return

    setServerError(false)

    startTransition(async () => {
      try {
        const user = {
          email: userDetails.email,
          name: userDetails.name,
          tenant_id: userDetails.tenant_id,
        }

        // Las subidas a GCS pueden tardar (videos grandes) — el timeout solo aplica al webhook
        let attachmentUrls: string[] = []
        if (type === "critical_incident" && selectedConversation && files.length > 0) {
          const contactId = selectedConversation.contact?.id
          if (!contactId) throw new Error("Contact ID no disponible")
          const { uploadFilesToGCS } = await import("@/lib/gcs/upload-client")
          attachmentUrls = await uploadFilesToGCS(files, contactId)
        }

        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 10_000)

        let res: Response

        if (type === "critical_incident" && selectedConversation) {
          const payload: Record<string, unknown> = {
            type,
            title: title.trim(),
            description: description.trim(),
            user,
            conversation_id: String(selectedConversation.id),
            contact: {
              id: selectedConversation.contact?.id,
              name: selectedConversation.contact?.name,
              phone_number: selectedConversation.contact?.phone_number,
              email: selectedConversation.contact?.email,
              last_activity_at: selectedConversation.contact?.last_activity_at,
            },
            inbox: {
              id: selectedConversation.inbox?.id,
              name: selectedConversation.inbox?.name,
              channel_type: selectedConversation.inbox?.channel_type,
            },
            ...(attachmentUrls.length > 0 && { attachments: attachmentUrls }),
          }

          res = await fetch(N8N_WEBHOOK_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
            signal: controller.signal,
          })
        } else {
          res = await fetch(N8N_WEBHOOK_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type, title: title.trim(), description: description.trim(), user }),
            signal: controller.signal,
          })
        }

        clearTimeout(timeoutId)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)

        toast({ description: "✓ Ticket enviado. El equipo de soporte te contactará pronto." })
        resetForm()
      } catch (err) {
        setServerError(true)
        if (err instanceof Error && err.name === "AbortError") {
          toast({ variant: "destructive", description: "Tiempo de espera agotado. Intenta con archivos más pequeños." })
        } else {
          toast({ variant: "destructive", description: "Error al enviar el ticket. Intenta nuevamente." })
        }
      }
    })
  }

  const validateAndAddFiles = (newFiles: File[]) => {
    const ALLOWED = ["image/jpeg", "image/png", "application/pdf", "video/mp4"]
    const IMG_LIMIT = 10 * 1024 * 1024
    const PDF_LIMIT = 20 * 1024 * 1024
    const MP4_LIMIT = 150 * 1024 * 1024

    const valid: File[] = []
    let typeError = false
    let sizeErrorMsg = ""

    for (const file of newFiles) {
      if (!ALLOWED.includes(file.type)) {
        typeError = true
        continue
      }
      const isImage = file.type.startsWith("image/")
      const isPdf = file.type === "application/pdf"
      const limit = isImage ? IMG_LIMIT : isPdf ? PDF_LIMIT : MP4_LIMIT
      if (file.size > limit) {
        if (isImage) sizeErrorMsg = "Las imágenes no pueden exceder 10MB"
        else if (isPdf) sizeErrorMsg = "Los PDFs no pueden exceder 20MB"
        else sizeErrorMsg = "Los videos MP4 no pueden exceder 150MB"
        continue
      }
      valid.push(file)
    }

    if (typeError) toast({ variant: "destructive", description: "Solo se aceptan JPG, JPEG, PNG, PDF y MP4" })
    if (sizeErrorMsg) toast({ variant: "destructive", description: sizeErrorMsg })
    if (!valid.length) return

    // toast fuera del setter — los updaters deben ser puros (sin side effects)
    const remaining = 10 - files.length
    if (remaining <= 0) {
      toast({ description: "Límite de 10 archivos alcanzado" })
      return
    }
    if (valid.length > remaining) toast({ description: "Límite de 10 archivos alcanzado" })
    setFiles((prev) => [...prev, ...valid.slice(0, remaining)])
  }

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const handleFileInput = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      validateAndAddFiles(Array.from(e.target.files))
      e.target.value = ""
    }
  }

  const handleTypeSelect = (t: TicketType) => {
    setType(t)
    setTouched((p) => ({ ...p, type: true }))
    if (t !== "critical_incident") {
      setSelectedConversation(null)
      setConvSearch("")
    } else {
      // bundle-preload: precarga el módulo GCS para que esté cacheado al hacer submit
      import("@/lib/gcs/upload-client")
    }
  }

  const handleConvTriggerClick = () => {
    setConvOpen((o) => !o)
    setTouched((p) => ({ ...p, conversation: true }))
  }

  const handleConversationSelect = (conv: Conversation) => {
    setSelectedConversation(conv)
    setConvOpen(false)
    setConvSearch("")
    setTouched((p) => ({ ...p, conversation: true }))
  }

  const touchTitle = () => setTouched((p) => ({ ...p, title: true }))
  const touchDescription = () => setTouched((p) => ({ ...p, description: true }))

  const getConvLabel = (conv: Conversation) => {
    const name = conv.contact?.name ?? "Sin nombre"
    const phone = conv.contact?.phone_number
    return phone ? `${name} - ${phone}` : name
  }

  // Derived — computed here so sidebar can receive them without re-deriving from type
  const selectedTypeMeta = type ? TICKET_TYPE_MAP.get(type) : undefined

  return {
    // State
    type,
    title,
    setTitle,
    description,
    setDescription,
    selectedConversation,
    conversations,
    convSearch,
    setConvSearch,
    loadingConvs,
    convOpen,
    submitting: isPending,
    serverError,
    touched,
    files,
    // Refs
    convDropdownRef,
    convTriggerRef,
    typeRef,
    titleRef,
    descRef,
    convRef,
    fileInputRef,
    // Derived
    errors,
    isValid,
    charCount,
    showConvField,
    selectedTypeMeta,
    // Handlers
    handleSubmit,
    handleTypeSelect,
    resetForm,
    getConvLabel,
    handleConvTriggerClick,
    handleConversationSelect,
    touchTitle,
    touchDescription,
    validateAndAddFiles,
    removeFile,
    handleFileInput,
    // From child hooks
    isUserLoading,
  }
}

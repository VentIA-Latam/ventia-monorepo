"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import type { DragEvent, ChangeEvent } from "react"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { getConversations } from "@/lib/api-client/messaging"
import type { Conversation } from "@/lib/types/messaging"
import { TICKET_TYPES, N8N_WEBHOOK_URL, type TicketType } from "./ticket-constants"

export function useTicketForm() {
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
  const [files, setFiles] = useState<File[]>([])
  const [dragOver, setDragOver] = useState(false)

  const convDropdownRef = useRef<HTMLDivElement>(null)
  const convTriggerRef = useRef<HTMLButtonElement>(null)
  const typeRef = useRef<HTMLDivElement>(null)
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
  const showConvField = type === "critical_incident"

  const resetForm = () => {
    setType(null)
    setDescription("")
    setSelectedConversation(null)
    setConvSearch("")
    setTouched({ type: false, description: false, conversation: false })
    setServerError(false)
    setFiles([])
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

    setSubmitting(true)
    setServerError(false)

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10_000)

      let res: Response

      if (type === "critical_incident" && selectedConversation) {
        const formData = new FormData()
        formData.append("type", type)
        formData.append("description", description.trim())
        formData.append("user", JSON.stringify({
          email: userDetails.email,
          name: userDetails.name,
          tenant_id: userDetails.tenant_id,
        }))
        formData.append("conversation_id", String(selectedConversation.id))
        formData.append("contact", JSON.stringify({
          id: selectedConversation.contact?.id,
          name: selectedConversation.contact?.name,
          phone_number: selectedConversation.contact?.phone_number,
          email: selectedConversation.contact?.email,
          last_activity_at: selectedConversation.contact?.last_activity_at,
        }))
        formData.append("inbox", JSON.stringify({
          id: selectedConversation.inbox?.id,
          name: selectedConversation.inbox?.name,
          channel_type: selectedConversation.inbox?.channel_type,
        }))
        files.forEach((file) => formData.append("attachments[]", file))

        res = await fetch(N8N_WEBHOOK_URL, {
          method: "POST",
          body: formData,
          signal: controller.signal,
        })
      } else {
        const payload: Record<string, unknown> = {
          type,
          description: description.trim(),
          user: {
            email: userDetails.email,
            name: userDetails.name,
            tenant_id: userDetails.tenant_id,
          },
        }

        res = await fetch(N8N_WEBHOOK_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: controller.signal,
        })
      }

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

  const validateAndAddFiles = (newFiles: File[]) => {
    const ALLOWED = ["image/jpeg", "image/png", "application/pdf"]
    const IMG_LIMIT = 2 * 1024 * 1024
    const PDF_LIMIT = 10 * 1024 * 1024

    const valid: File[] = []
    let typeError = false
    let sizeErrorMsg = ""

    for (const file of newFiles) {
      if (!ALLOWED.includes(file.type)) {
        typeError = true
        continue
      }
      const isImage = file.type.startsWith("image/")
      const limit = isImage ? IMG_LIMIT : PDF_LIMIT
      if (file.size > limit) {
        sizeErrorMsg = `${isImage ? "Las imágenes" : "Los PDFs"} no pueden exceder ${isImage ? 2 : 10}MB`
        continue
      }
      valid.push(file)
    }

    if (typeError) toast({ variant: "destructive", description: "Solo se aceptan JPG, JPEG, PNG y PDF" })
    if (sizeErrorMsg) toast({ variant: "destructive", description: sizeErrorMsg })
    if (!valid.length) return

    const remaining = 5 - files.length
    if (remaining <= 0) {
      toast({ description: "Límite de 5 archivos alcanzado" })
      return
    }
    if (valid.length > remaining) toast({ description: "Límite de 5 archivos alcanzado" })
    setFiles((prev) => [...prev, ...valid.slice(0, remaining)])
  }

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(true)
  }

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)
  }

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)
    validateAndAddFiles(Array.from(e.dataTransfer.files))
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

  const touchDescription = () => setTouched((p) => ({ ...p, description: true }))

  const getConvLabel = (conv: Conversation) => {
    const name = conv.contact?.name ?? "Sin nombre"
    const phone = conv.contact?.phone_number
    return phone ? `${name} - ${phone}` : name
  }

  // Derived — computed here so sidebar can receive them without re-deriving from type
  const selectedTypeMeta = TICKET_TYPES.find((t) => t.id === type)

  return {
    // State
    type,
    description,
    setDescription,
    selectedConversation,
    conversations,
    convSearch,
    setConvSearch,
    loadingConvs,
    convOpen,
    submitting,
    serverError,
    touched,
    files,
    dragOver,
    // Refs
    convDropdownRef,
    convTriggerRef,
    typeRef,
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
    touchDescription,
    validateAndAddFiles,
    removeFile,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleFileInput,
    // From child hooks
    isUserLoading,
  }
}

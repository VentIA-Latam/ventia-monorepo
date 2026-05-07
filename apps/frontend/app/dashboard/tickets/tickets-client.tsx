"use client"

import { AlertTriangle, Send, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useTicketForm } from "@/hooks/use-ticket-form"
import { TicketTypeSelector } from "@/components/tickets/ticket-type-selector"
import { DescriptionField } from "@/components/tickets/description-field"
import { ConversationSelector } from "@/components/tickets/conversation-selector"
import { TicketSidebar } from "@/components/tickets/ticket-sidebar"
import { FileUploadZone } from "@/components/tickets/file-upload-zone"

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

export function TicketsClient() {
  const {
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
    submitting,
    serverError,
    touched,
    files,
    convDropdownRef,
    convTriggerRef,
    typeRef,
    titleRef,
    descRef,
    convRef,
    fileInputRef,
    errors,
    isValid,
    charCount,
    showConvField,
    handleSubmit,
    handleTypeSelect,
    resetForm,
    getConvLabel,
    handleConvTriggerClick,
    handleConversationSelect,
    touchTitle,
    touchDescription,
    removeFile,
    validateAndAddFiles,
    handleFileInput,
    isUserLoading,
  } = useTicketForm()

  return (
    <div className="flex flex-col gap-6 pb-8">

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

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6 items-start">

        <div className="flex flex-col gap-8">

          {/* Field 1: Ticket type */}
          <div ref={typeRef}>
            <FieldLabel step={1} label="Tipo de ticket" required />
            <TicketTypeSelector
              value={type}
              onChange={handleTypeSelect}
              touched={touched.type}
            />
            {touched.type && errors.type && <FieldError message={errors.type} />}
          </div>

          {/* Field 2: Title */}
          <div ref={titleRef}>
            <FieldLabel step={2} label="Título" required />
            <p className="text-xs text-muted-foreground mt-1 mb-2">
              Resume el problema en una frase corta. Máximo 100 caracteres.
            </p>
            <div className="relative">
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={touchTitle}
                placeholder="Ej: El agente no responde preguntas sobre envíos"
                maxLength={100}
                disabled={submitting}
                aria-invalid={touched.title && !!errors.title}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground pointer-events-none">
                {title.length}/100
              </span>
            </div>
            {touched.title && errors.title && <FieldError message={errors.title} />}
          </div>

          {/* Field 3: Description */}
          <div ref={descRef}>
            <FieldLabel step={3} label="Descripción" required />
            <p className="text-xs text-muted-foreground mt-1 mb-2">
              Describe qué ocurrió, cuándo y qué esperabas. Mínimo 10 caracteres.
            </p>
            <DescriptionField
              value={description}
              onChange={setDescription}
              onBlur={touchDescription}
              disabled={submitting}
              hasError={touched.description && !!errors.description}
            />
            {touched.description && errors.description && <FieldError message={errors.description} />}
          </div>

          {/* Field 4: Conversation selector (only for critical incidents) */}
          {showConvField && (
            <div ref={convRef}>
              <FieldLabel step={4} label="Chat asociado" required />
              <p className="text-xs text-muted-foreground mt-1 mb-2">
                Selecciona la conversación donde ocurrió el problema.
              </p>
              <ConversationSelector
                open={convOpen}
                onTriggerClick={handleConvTriggerClick}
                conversations={conversations}
                loadingConvs={loadingConvs}
                search={convSearch}
                onSearchChange={setConvSearch}
                selected={selectedConversation}
                onSelect={handleConversationSelect}
                getLabel={getConvLabel}
                hasError={touched.conversation && !!errors.conversation}
                dropdownRef={convDropdownRef}
                triggerRef={convTriggerRef}
              />
              {touched.conversation && errors.conversation && <FieldError message={errors.conversation} />}
            </div>
          )}

          {/* Field 5: File upload (only for critical incidents) */}
          {showConvField && (
            <div>
              <FieldLabel step={5} label="Archivos adjuntos" />
              <p className="text-xs text-muted-foreground mt-1 mb-2">
                Adjunta capturas de pantalla o documentos que ayuden a entender el problema. Opcional.
              </p>
              <FileUploadZone
                files={files}
                fileInputRef={fileInputRef}
                onValidateFiles={validateAndAddFiles}
                onFileInput={handleFileInput}
                onRemoveFile={removeFile}
              />
            </div>
          )}

          {/* Server error */}
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
              <Button variant="outline" disabled={submitting} onClick={resetForm}>
                Limpiar
              </Button>
              <Button onClick={handleSubmit} disabled={submitting || isUserLoading} className="gap-2">
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

        <TicketSidebar
          type={type}
          charCount={charCount}
          selectedConversation={selectedConversation}
          showConvField={showConvField}
        />

      </div>
    </div>
  )
}

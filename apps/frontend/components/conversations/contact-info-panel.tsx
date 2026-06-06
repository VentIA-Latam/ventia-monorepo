"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Phone,
  Mail,
  Fingerprint,
  X,
  ChevronDown,
  Check,
  AlertTriangle,
  Pencil,
} from "lucide-react";
import { TemperatureSelector } from "./temperature-selector";
import { LabelManager } from "./label-manager";
import { ContactEditForm, type ContactEditFormHandle } from "./contact-edit-form";
import { ContactNotesList } from "./contact-notes-list";
import { updateConversationStage } from "@/lib/api-client/messaging";
import type {
  Conversation,
  ContactBrief,
  Label,
  ConversationTemperature,
  TemperatureDefinition,
} from "@/lib/types/messaging";
import { getInitials } from "@/lib/utils/messaging";

interface ContactInfoPanelProps {
  conversation: Conversation;
  allLabels: Label[];
  temperatureConfig?: TemperatureDefinition[];
  tenantId?: number;
  onClose?: () => void;
  onConversationUpdate?: (updated: Conversation) => void;
  onLabelCreated?: (label: Label) => void;
  onEditModeChange?: (editing: boolean) => void;
}

const stageConfig: Record<string, { label: string; className: string }> = {
  pre_sale: { label: "Pre-venta", className: "bg-info-bg text-info border-info/30" },
  sale: { label: "Venta", className: "bg-success-bg text-success border-success/30" },
};

export const ContactInfoPanel = memo(function ContactInfoPanel({
  conversation,
  allLabels,
  temperatureConfig = [],
  tenantId,
  onClose,
  onConversationUpdate,
  onLabelCreated,
  onEditModeChange,
}: ContactInfoPanelProps) {
  const contact = conversation.contact;
  const stageConf = stageConfig[conversation.stage] ?? stageConfig.pre_sale;
  const router = useRouter();
  const { role } = useAuth();
  const isAdmin = role?.toUpperCase() === "ADMIN";

  const [mode, setMode] = useState<"view" | "edit">("view");
  const [formDirty, setFormDirty] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [notesCount, setNotesCount] = useState<number | null>(
    contact?.notes_count ?? null
  );
  const formRef = useRef<ContactEditFormHandle>(null);

  useEffect(() => {
    onEditModeChange?.(mode === "edit");
  }, [mode, onEditModeChange]);

  useEffect(() => {
    return () => onEditModeChange?.(false);
  }, [onEditModeChange]);

  const handleReportIncident = useCallback(() => {
    router.push(
      `/dashboard/tickets?type=critical_incident&conversationId=${conversation.id}`
    );
  }, [router, conversation.id]);

  const handleStageChange = useCallback(
    async (stage: "pre_sale" | "sale") => {
      if (stage === conversation.stage) return;
      const previousStage = conversation.stage;
      onConversationUpdate?.({ ...conversation, stage });
      try {
        await updateConversationStage(conversation.id, stage, tenantId);
      } catch (err) {
        console.error("Error updating stage:", err);
        onConversationUpdate?.({ ...conversation, stage: previousStage });
      }
    },
    [conversation, tenantId, onConversationUpdate]
  );

  const handleEnterEdit = useCallback(() => {
    setMode("edit");
  }, []);

  const exitEditMode = useCallback(() => {
    setMode("view");
    setFormDirty(false);
  }, []);

  const handleCancelEdit = useCallback(() => {
    if (formDirty) {
      setDiscardOpen(true);
    } else {
      exitEditMode();
    }
  }, [formDirty, exitEditMode]);

  const handleConfirmDiscard = useCallback(() => {
    setDiscardOpen(false);
    exitEditMode();
  }, [exitEditMode]);

  const handleSubmitForm = useCallback(() => {
    formRef.current?.submit();
  }, []);

  const handleSaved = useCallback(
    (updated: ContactBrief) => {
      if (contact) {
        onConversationUpdate?.({
          ...conversation,
          contact: { ...contact, ...updated },
        });
      }
      exitEditMode();
    },
    [contact, conversation, onConversationUpdate, exitEditMode]
  );

  // Keyboard shortcuts in edit mode: ESC = cancel, ⌘+S = save
  useEffect(() => {
    if (mode !== "edit") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        handleCancelEdit();
      } else if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        handleSubmitForm();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode, handleCancelEdit, handleSubmitForm]);

  // ─── EDIT MODE ───────────────────────────────────────────────
  if (mode === "edit" && contact) {
    return (
      <div className="flex flex-col h-full">
        <div className="px-4 py-3 border-b flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <Avatar className="h-9 w-9 shrink-0">
              <AvatarFallback className="text-sm">
                {getInitials(contact.name)}
              </AvatarFallback>
            </Avatar>
            <p className="text-sm font-semibold tracking-tight truncate">
              Editar contacto
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={handleCancelEdit}
            aria-label="Cerrar editor"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          <ContactEditForm
            ref={formRef}
            contact={contact}
            tenantId={tenantId}
            onCancel={exitEditMode}
            onSaved={handleSaved}
            onDirtyChange={setFormDirty}
          />

          <Separator />

          <div className="space-y-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Notas{notesCount !== null && ` (${notesCount})`}
            </p>
            <ContactNotesList
              contactId={contact.id}
              tenantId={tenantId}
              editable
              onCountChange={setNotesCount}
            />
          </div>
        </div>

        <div className="px-4 py-3 border-t flex gap-2 shrink-0 bg-background">
          <Button
            variant="outline"
            className="flex-1"
            onClick={handleCancelEdit}
          >
            Cancelar
          </Button>
          <Button className="flex-1" onClick={handleSubmitForm}>
            Guardar
          </Button>
        </div>

        <AlertDialog open={discardOpen} onOpenChange={setDiscardOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Descartar cambios sin guardar?</AlertDialogTitle>
              <AlertDialogDescription>
                Los cambios que hiciste se perderán.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Seguir editando</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleConfirmDiscard}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Descartar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  // ─── VIEW MODE ───────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b flex items-center justify-between shrink-0">
        <p className="text-sm font-medium">Información</p>
        <div className="flex items-center gap-1">
          {contact && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handleEnterEdit}
              aria-label="Editar contacto"
              title="Editar contacto"
            >
              <Pencil className="h-4 w-4" />
            </Button>
          )}
          {onClose && (
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Contact info */}
        <div className="flex flex-col items-center text-center">
          <Avatar className="h-16 w-16 mb-3">
            <AvatarFallback className="text-lg">
              {getInitials(contact?.name)}
            </AvatarFallback>
          </Avatar>
          <p className="font-medium">{contact?.name || "Sin nombre"}</p>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={`mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-medium transition-colors hover:opacity-80 ${stageConf.className}`}
              >
                {stageConf.label}
                <ChevronDown className="h-3 w-3" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" className="w-36">
              {(Object.entries(stageConfig) as [string, { label: string; className: string }][]).map(
                ([key, conf]) => (
                  <DropdownMenuItem
                    key={key}
                    onClick={() => handleStageChange(key as "pre_sale" | "sale")}
                    className="flex items-center justify-between"
                  >
                    {conf.label}
                    {conversation.stage === key && (
                      <Check className="h-3.5 w-3.5 text-primary" />
                    )}
                  </DropdownMenuItem>
                )
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <Separator />

        {/* Contact details */}
        <div className="space-y-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Contacto
          </p>
          {contact?.phone_number || contact?.whatsapp_bsuid ? (
            <div className="flex items-center gap-3 text-sm">
              {contact.phone_number ? (
                <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
              ) : (
                <Fingerprint className="h-4 w-4 text-muted-foreground shrink-0" />
              )}
              <span
                className={
                  contact.phone_number ? "tabular-nums" : "font-mono text-xs tracking-wide"
                }
              >
                {contact.phone_number ?? contact.whatsapp_bsuid}
              </span>
            </div>
          ) : null}
          {contact?.email && (
            <div className="flex items-center gap-3 text-sm">
              <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="truncate">{contact.email}</span>
            </div>
          )}
        </div>

        <Separator />

        {/* Temperature */}
        <div className="space-y-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Temperatura
          </p>
          <TemperatureSelector
            conversationId={conversation.id}
            value={conversation.temperature}
            temperatureConfig={temperatureConfig}
            tenantId={tenantId}
            onChange={(temp: ConversationTemperature) =>
              onConversationUpdate?.({ ...conversation, temperature: temp })
            }
          />
        </div>

        <Separator />

        {/* Labels */}
        <div className="space-y-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Etiquetas
          </p>
          <LabelManager
            conversationId={conversation.id}
            labels={conversation.labels ?? []}
            allLabels={allLabels}
            tenantId={tenantId}
            onChange={(labels: Label[]) =>
              onConversationUpdate?.({ ...conversation, labels })
            }
            onLabelsCreated={onLabelCreated}
          />
        </div>

        {/* Notes (view mode, read-only) */}
        {contact && (
          <>
            <Separator />
            <div className="space-y-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Notas{notesCount !== null && ` (${notesCount})`}
              </p>
              <ContactNotesList
                contactId={contact.id}
                tenantId={tenantId}
                editable={false}
                onCountChange={setNotesCount}
              />
            </div>
          </>
        )}

        <Separator />

        {/* Metadata */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Detalles
          </p>
          <div className="text-xs text-muted-foreground space-y-1">
            <p>ID: {conversation.id}</p>
            {conversation.messages_count != null && (
              <p>Mensajes: {conversation.messages_count}</p>
            )}
            {conversation.created_at && (
              <p>
                Creada:{" "}
                {new Date(conversation.created_at).toLocaleDateString("es-PE", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            )}
          </div>
        </div>

        {isAdmin && (
          <>
            <Separator />
            <div className="pb-1">
              <Button
                variant="outline"
                size="sm"
                className="w-full border-destructive/40 text-destructive hover:bg-destructive/5 hover:text-destructive gap-2"
                onClick={handleReportIncident}
              >
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                Reportar incidencia crítica
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
});

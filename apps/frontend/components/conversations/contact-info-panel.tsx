"use client";

import { memo, useCallback, useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Phone, Mail, X, RotateCcw } from "lucide-react";
import { TemperatureSelector } from "./temperature-selector";
import { LabelManager } from "./label-manager";
import { updateConversation } from "@/lib/api-client/messaging";
import type { Conversation, Label, ConversationTemperature, TemperatureDefinition } from "@/lib/types/messaging";
import { getInitials } from "@/lib/utils/messaging";

interface ContactInfoPanelProps {
  conversation: Conversation;
  allLabels: Label[];
  temperatureConfig?: TemperatureDefinition[];
  tenantId?: number;
  onClose?: () => void;
  onConversationUpdate?: (updated: Conversation) => void;
  onLabelCreated?: (label: Label) => void;
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
}: ContactInfoPanelProps) {
  const contact = conversation.contact;
  const stageConf = stageConfig[conversation.stage] ?? stageConfig.pre_sale;
  const isSale = conversation.stage === "sale";
  const [resettingStage, setResettingStage] = useState(false);

  const handleResetStage = useCallback(async () => {
    setResettingStage(true);
    try {
      await updateConversation(conversation.id, { stage: "pre_sale" }, tenantId);
      onConversationUpdate?.({ ...conversation, stage: "pre_sale" });
    } catch (err) {
      console.error("Error resetting stage:", err);
    } finally {
      setResettingStage(false);
    }
  }, [conversation, tenantId, onConversationUpdate]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b flex items-center justify-between shrink-0">
        <p className="text-sm font-medium">Información</p>
        {onClose && (
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Contact info */}
        <div className="flex flex-col items-center text-center">
          <Avatar className="h-16 w-16 mb-3">
            <AvatarFallback className="text-lg">
              {getInitials(contact?.name)}
            </AvatarFallback>
          </Avatar>
          <p className="font-medium">
            {contact?.name || "Sin nombre"}
          </p>
          <Badge variant="outline" className={`mt-2 ${stageConf.className}`}>
            {stageConf.label}
          </Badge>
          {isSale && (
            <button
              onClick={handleResetStage}
              disabled={resettingStage}
              className="mt-2 inline-flex items-center gap-1.5 text-[11px] text-muted-foreground/70 hover:text-primary px-2.5 py-1 rounded-md hover:bg-primary/5 transition-colors disabled:opacity-50"
            >
              <RotateCcw className="h-3 w-3" />
              {resettingStage ? "Volviendo..." : "Volver a pre-venta"}
            </button>
          )}
        </div>

        <Separator />

        {/* Contact details */}
        <div className="space-y-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Contacto
          </p>
          {contact?.phone_number && (
            <div className="flex items-center gap-3 text-sm">
              <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
              <span>{contact.phone_number}</span>
            </div>
          )}
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
      </div>
    </div>
  );
})

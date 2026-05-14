"use client";

import { memo, useCallback, useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Phone, Mail, Fingerprint, X, ChevronDown, Check } from "lucide-react";
import { TemperatureSelector } from "./temperature-selector";
import { LabelManager } from "./label-manager";
import { updateConversation, updateConversationStage } from "@/lib/api-client/messaging";
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

  const handleStageChange = useCallback(async (stage: "pre_sale" | "sale") => {
    if (stage === conversation.stage) return;
    const previousStage = conversation.stage;
    onConversationUpdate?.({ ...conversation, stage });
    try {
      await updateConversationStage(conversation.id, stage, tenantId);
    } catch (err) {
      console.error("Error updating stage:", err);
      onConversationUpdate?.({ ...conversation, stage: previousStage });
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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className={`mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-medium transition-colors hover:opacity-80 ${stageConf.className}`}>
                {stageConf.label}
                <ChevronDown className="h-3 w-3" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" className="w-36">
              {(Object.entries(stageConfig) as [string, { label: string; className: string }][]).map(([key, conf]) => (
                <DropdownMenuItem
                  key={key}
                  onClick={() => handleStageChange(key as "pre_sale" | "sale")}
                  className="flex items-center justify-between"
                >
                  {conf.label}
                  {conversation.stage === key && <Check className="h-3.5 w-3.5 text-primary" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <Separator />

        {/* Contact details */}
        <div className="space-y-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Contacto
          </p>
          {(contact?.phone_number || contact?.identifier) ? (
            <div className="flex items-center gap-3 text-sm">
              {contact.phone_number ? (
                <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
              ) : (
                <Fingerprint className="h-4 w-4 text-muted-foreground shrink-0" />
              )}
              <span className={contact.phone_number ? "" : "font-mono text-xs tracking-wide"}>
                {contact.phone_number ?? contact.identifier}
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

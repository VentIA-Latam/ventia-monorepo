"use client";

import { useState, useCallback } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Phone, Mail, UserCircle, Users, X } from "lucide-react";
import { assignConversation, unassignConversation } from "@/lib/api-client/messaging";
import { TemperatureSelector } from "./temperature-selector";
import { LabelManager } from "./label-manager";
import { useToast } from "@/hooks/use-toast";
import type { Conversation, Team, Label, ConversationTemperature } from "@/lib/types/messaging";

interface ContactInfoPanelProps {
  conversation: Conversation;
  teams: Team[];
  allLabels: Label[];
  onClose?: () => void;
  onConversationUpdate?: (updated: Conversation) => void;
  onLabelCreated?: (label: Label) => void;
}

function getInitials(name: string | null | undefined): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

const statusConfig: Record<string, { label: string; className: string }> = {
  open: { label: "Abierta", className: "bg-success-bg text-success border-success/30" },
  pending: { label: "Pendiente", className: "bg-warning-bg text-warning border-warning/30" },
  resolved: { label: "Resuelta", className: "bg-muted/50 text-foreground border-border" },
};

export function ContactInfoPanel({
  conversation,
  teams,
  allLabels,
  onClose,
  onConversationUpdate,
  onLabelCreated,
}: ContactInfoPanelProps) {
  const { toast } = useToast();
  const [assigning, setAssigning] = useState(false);
  const contact = conversation.contact;
  const config = statusConfig[conversation.status] ?? statusConfig.open;

  const handleTeamAssign = useCallback(
    async (teamId: string) => {
      setAssigning(true);
      try {
        await assignConversation(conversation.id, { team_id: teamId });
        toast({ title: "Equipo asignado" });
      } catch {
        toast({ title: "Error al asignar equipo", variant: "destructive" });
      } finally {
        setAssigning(false);
      }
    },
    [conversation.id, toast]
  );

  const handleUnassign = useCallback(async () => {
    setAssigning(true);
    try {
      await unassignConversation(conversation.id);
      toast({ title: "Asignación removida" });
    } catch {
      toast({ title: "Error al remover asignación", variant: "destructive" });
    } finally {
      setAssigning(false);
    }
  }, [conversation.id, toast]);

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
          <Badge variant="outline" className={`mt-2 ${config.className}`}>
            {config.label}
          </Badge>
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
            onChange={(labels: Label[]) =>
              onConversationUpdate?.({ ...conversation, labels })
            }
            onLabelsCreated={onLabelCreated}
          />
        </div>

        <Separator />

        {/* Assignment */}
        <div className="space-y-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Asignación
          </p>

          {/* Current assignee */}
          {conversation.assignee ? (
            <div className="flex items-center gap-3 text-sm">
              <UserCircle className="h-4 w-4 text-muted-foreground shrink-0" />
              <span>{conversation.assignee.name || conversation.assignee.email}</span>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic">Sin agente asignado</p>
          )}

          {/* Current team */}
          {conversation.team && (
            <div className="flex items-center gap-3 text-sm">
              <Users className="h-4 w-4 text-muted-foreground shrink-0" />
              <span>{conversation.team.name}</span>
            </div>
          )}

          {/* Team selector */}
          {teams.length > 0 && (
            <Select
              value={conversation.team?.id ?? ""}
              onValueChange={handleTeamAssign}
              disabled={assigning}
            >
              <SelectTrigger className="w-full text-sm">
                <SelectValue placeholder="Asignar equipo" />
              </SelectTrigger>
              <SelectContent>
                {teams.map((team) => (
                  <SelectItem key={team.id} value={team.id}>
                    {team.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Unassign button */}
          {(conversation.assignee || conversation.team) && (
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={handleUnassign}
              disabled={assigning}
            >
              Remover asignación
            </Button>
          )}
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
}

"use client";

import { useState, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Search, MessageSquare, Loader2 } from "lucide-react";
import { ConversationItem } from "./conversation-item";
import { getConversations } from "@/lib/api-client/messaging";
import type { Conversation, ConversationStatus } from "@/lib/types/messaging";

interface ConversationListProps {
  conversations: Conversation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onConversationsChange: (conversations: Conversation[]) => void;
}

const STATUS_TABS: { value: ConversationStatus; label: string }[] = [
  { value: "open", label: "Abiertas" },
  { value: "pending", label: "Pendientes" },
  { value: "resolved", label: "Resueltas" },
];

export function ConversationList({
  conversations,
  selectedId,
  onSelect,
  onConversationsChange,
}: ConversationListProps) {
  const [statusFilter, setStatusFilter] = useState<ConversationStatus>("open");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);

  const handleStatusChange = useCallback(
    async (status: ConversationStatus) => {
      setStatusFilter(status);
      setLoading(true);
      try {
        const data = await getConversations({ status });
        onConversationsChange(data.data ?? []);
      } catch (error) {
        console.error("Error fetching conversations:", error);
      } finally {
        setLoading(false);
      }
    },
    [onConversationsChange]
  );

  const filteredConversations = searchQuery
    ? conversations.filter((c) => {
        const query = searchQuery.toLowerCase();
        return (
          c.contact?.name?.toLowerCase().includes(query) ||
          c.contact?.phone_number?.toLowerCase().includes(query) ||
          c.contact?.email?.toLowerCase().includes(query)
        );
      })
    : conversations;

  return (
    <div className="flex flex-col h-full">
      {/* Status tabs */}
      <div className="p-3 border-b space-y-3">
        <div className="flex gap-1">
          {STATUS_TABS.map((tab) => (
            <Button
              key={tab.value}
              variant={statusFilter === tab.value ? "default" : "ghost"}
              size="sm"
              className="flex-1 text-xs"
              onClick={() => handleStatusChange(tab.value)}
            >
              {tab.label}
            </Button>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar contacto..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {loading ? (
          <div className="space-y-1 p-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-3">
                <Skeleton className="h-10 w-10 rounded-full shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredConversations.length === 0 ? (
          <EmptyState
            icon={<MessageSquare className="h-6 w-6" />}
            title="Sin conversaciones"
            description={
              searchQuery
                ? "No hay resultados para esta búsqueda."
                : "No hay conversaciones en este estado."
            }
          />
        ) : (
          filteredConversations.map((conversation) => (
            <ConversationItem
              key={conversation.id}
              conversation={conversation}
              isSelected={selectedId === conversation.id}
              onClick={() => onSelect(conversation.id)}
            />
          ))
        )}
      </div>

      {/* Count */}
      {!loading && filteredConversations.length > 0 && (
        <div className="p-3 border-t">
          <p className="text-xs text-muted-foreground text-center">
            {filteredConversations.length} conversación{filteredConversations.length !== 1 ? "es" : ""}
          </p>
        </div>
      )}
    </div>
  );
}

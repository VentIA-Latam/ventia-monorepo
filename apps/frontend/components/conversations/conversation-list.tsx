"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Search, MessageSquare, Loader2 } from "lucide-react";
import { ConversationItem } from "./conversation-item";
import { ConversationFilters, type ActiveFilters } from "./conversation-filters";
import { useMessaging } from "./messaging-provider";
import { getConversations, deleteConversation, type ConversationFilters as ConversationFilterParams } from "@/lib/api-client/messaging";
import { cn } from "@/lib/utils";
import type { Conversation, ConversationStatus, Label } from "@/lib/types/messaging";

interface ConversationListProps {
  conversations: Conversation[];
  selectedId: number | null;
  allLabels: Label[];
  onSelect: (id: number) => void;
  onConversationsChange: (conversations: Conversation[]) => void;
  onDeleteConversation?: (id: number) => void;
}

type FilterValue = "all" | ConversationStatus;

const FILTER_CHIPS: { value: FilterValue; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "open", label: "Abiertas" },
  { value: "pending", label: "Pendientes" },
  { value: "resolved", label: "Resueltas" },
];

export function ConversationList({
  conversations,
  selectedId,
  allLabels,
  onSelect,
  onConversationsChange,
  onDeleteConversation,
}: ConversationListProps) {
  const { lastEvent } = useMessaging();
  const [statusFilter, setStatusFilter] = useState<FilterValue>("open");
  const [activeFilters, setActiveFilters] = useState<ActiveFilters>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const statusFilterRef = useRef(statusFilter);
  statusFilterRef.current = statusFilter;
  const activeFiltersRef = useRef(activeFilters);
  activeFiltersRef.current = activeFilters;

  const buildParams = useCallback(
    (status: FilterValue, filters: ActiveFilters): ConversationFilterParams => {
      const params: ConversationFilterParams = {};
      if (status !== "all") params.status = status;
      if (filters.label) params.label = filters.label;
      if (filters.temperature) params.temperature = filters.temperature;
      if (filters.dateRange) {
        params.created_after = filters.dateRange.from;
        params.created_before = filters.dateRange.to;
      }
      if (filters.unread) params.unread = "true";
      return params;
    },
    []
  );

  const fetchConversations = useCallback(
    async (params: ConversationFilterParams) => {
      setLoading(true);
      try {
        const data = await getConversations(params);
        onConversationsChange(data.data ?? []);
      } catch (error) {
        console.error("Error fetching conversations:", error);
      } finally {
        setLoading(false);
      }
    },
    [onConversationsChange]
  );

  const handleStatusChange = useCallback(
    (filter: FilterValue) => {
      setStatusFilter(filter);
      fetchConversations(buildParams(filter, activeFiltersRef.current));
    },
    [fetchConversations, buildParams]
  );

  const handleFiltersChange = useCallback(
    (filters: ActiveFilters) => {
      setActiveFilters(filters);
      fetchConversations(buildParams(statusFilterRef.current, filters));
    },
    [fetchConversations, buildParams]
  );

  const handleDelete = useCallback(
    async (id: number) => {
      try {
        await deleteConversation(id);
        onConversationsChange(conversations.filter((c) => c.id !== id));
        onDeleteConversation?.(id);
      } catch (error) {
        console.error("Error deleting conversation:", error);
      }
    },
    [conversations, onConversationsChange, onDeleteConversation]
  );

  // Refresh conversation list on real-time events
  useEffect(() => {
    if (!lastEvent) return;
    const { event } = lastEvent;
    if (
      event === "message.created" ||
      event === "conversation.created" ||
      event === "conversation.updated" ||
      event === "conversation.status_changed"
    ) {
      const params = buildParams(statusFilterRef.current, activeFiltersRef.current);
      getConversations(params)
        .then((data) => onConversationsChange(data.data ?? []))
        .catch((err) => console.error("Error refreshing conversations:", err));
    }
  }, [lastEvent, onConversationsChange, buildParams]);

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
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="px-4 pt-4 pb-2">
        <h2 className="text-xl font-bold">Chats</h2>
      </div>

      {/* Search */}
      <div className="px-3 pb-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar o iniciar chat"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 text-sm rounded-full bg-muted/50 border-0 focus-visible:ring-1 focus-visible:ring-primary/30"
          />
        </div>
      </div>

      {/* Filter chips */}
      <div className="px-3 pb-2 flex gap-1.5 overflow-x-auto no-scrollbar">
        {FILTER_CHIPS.map((chip) => (
          <button
            key={chip.value}
            onClick={() => handleStatusChange(chip.value)}
            className={cn(
              "shrink-0 rounded-full text-xs px-3 py-1.5 font-medium transition-colors",
              statusFilter === chip.value
                ? "bg-primary text-primary-foreground"
                : "bg-muted/60 text-muted-foreground hover:bg-muted"
            )}
          >
            {chip.label}
          </button>
        ))}
      </div>

      {/* Advanced filters */}
      <ConversationFilters
        allLabels={allLabels}
        filters={activeFilters}
        onChange={handleFiltersChange}
      />

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="space-y-0">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 py-3 px-4 border-b border-border/30">
                <Skeleton className="h-12 w-12 rounded-full shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-3 w-48" />
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
              onDelete={handleDelete}
            />
          ))
        )}
      </div>
    </div>
  );
}

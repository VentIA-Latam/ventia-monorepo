"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Search, MessageSquare } from "lucide-react";
import { ConversationItem } from "./conversation-item";
import { ConversationFilters, type ActiveFilters } from "./conversation-filters";
import { useMessaging } from "./messaging-provider";
import {
  getConversations,
  getConversationCounts,
  deleteConversation,
  type ConversationFilters as ConversationFilterParams,
} from "@/lib/api-client/messaging";
import { cn } from "@/lib/utils";
import type { Conversation, ConversationCounts, Label } from "@/lib/types/messaging";

interface ConversationListProps {
  conversations: Conversation[];
  selectedId: number | null;
  allLabels: Label[];
  onSelect: (id: number) => void;
  onConversationsChange: (conversations: Conversation[]) => void;
  onDeleteConversation?: (id: number) => void;
}

type SectionValue = "all" | "sale" | "unattended";

const SECTION_TABS: { value: SectionValue; label: string; countKey?: keyof ConversationCounts }[] = [
  { value: "all", label: "Todas" },
  { value: "sale", label: "Venta", countKey: "sale" },
  { value: "unattended", label: "No Atendida", countKey: "unattended" },
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
  const [sectionFilter, setSectionFilter] = useState<SectionValue>("all");
  const [activeFilters, setActiveFilters] = useState<ActiveFilters>({});
  const [counts, setCounts] = useState<ConversationCounts | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const sectionFilterRef = useRef(sectionFilter);
  sectionFilterRef.current = sectionFilter;
  const activeFiltersRef = useRef(activeFilters);
  activeFiltersRef.current = activeFilters;

  const buildParams = useCallback(
    (section: SectionValue, filters: ActiveFilters): ConversationFilterParams => {
      const params: ConversationFilterParams = {};
      if (section === "sale") params.stage = "sale";
      if (section === "unattended") params.conversation_type = "unattended";
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

  const fetchCounts = useCallback(async () => {
    try {
      const result = await getConversationCounts();
      setCounts(result.data);
    } catch (error) {
      console.error("Error fetching counts:", error);
    }
  }, []);

  const handleSectionChange = useCallback(
    (section: SectionValue) => {
      setSectionFilter(section);
      setActiveFilters({});
      fetchConversations(buildParams(section, {}));
    },
    [fetchConversations, buildParams]
  );

  const handleFiltersChange = useCallback(
    (filters: ActiveFilters) => {
      setActiveFilters(filters);
      fetchConversations(buildParams(sectionFilterRef.current, filters));
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

  // Fetch counts on mount
  useEffect(() => {
    fetchCounts();
  }, [fetchCounts]);

  // Refresh conversation list and counts on real-time events
  useEffect(() => {
    if (!lastEvent) return;
    const { event } = lastEvent;
    if (
      event === "message.created" ||
      event === "conversation.created" ||
      event === "conversation.updated" ||
      event === "conversation.status_changed" ||
      event === "conversation.read"
    ) {
      const params = buildParams(sectionFilterRef.current, activeFiltersRef.current);
      getConversations(params)
        .then((data) => onConversationsChange(data.data ?? []))
        .catch((err) => console.error("Error refreshing conversations:", err));
      fetchCounts();
    }
  }, [lastEvent, onConversationsChange, buildParams, fetchCounts]);

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

      {/* Section tabs */}
      <div className="px-3 pb-2 flex gap-1.5 overflow-x-auto no-scrollbar">
        {SECTION_TABS.map((tab) => {
          const count = tab.countKey && counts ? counts[tab.countKey] : null;
          return (
            <button
              key={tab.value}
              onClick={() => handleSectionChange(tab.value)}
              className={cn(
                "shrink-0 rounded-full text-xs px-3 py-1.5 font-medium transition-colors flex items-center gap-1.5",
                sectionFilter === tab.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/60 text-muted-foreground hover:bg-muted"
              )}
            >
              {tab.label}
              {count !== null && count > 0 && (
                <span
                  className={cn(
                    "inline-flex items-center justify-center rounded-full text-[10px] font-semibold min-w-[18px] h-[18px] px-1",
                    sectionFilter === tab.value
                      ? "bg-primary-foreground/20 text-primary-foreground"
                      : "bg-primary/10 text-primary"
                  )}
                >
                  {count > 99 ? "99+" : count}
                </span>
              )}
            </button>
          );
        })}
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
                : sectionFilter === "unattended"
                  ? "Todas las conversaciones están atendidas."
                  : sectionFilter === "sale"
                    ? "No hay conversaciones de venta."
                    : "No hay conversaciones."
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

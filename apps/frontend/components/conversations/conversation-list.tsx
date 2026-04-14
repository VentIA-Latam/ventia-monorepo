"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Search, MessageSquare, Loader2 } from "lucide-react";
import { ConversationItem } from "./conversation-item";
import { ConversationFilters, type ActiveFilters } from "./conversation-filters";
import { useMessagingEvent, useMessagingEmit } from "./messaging-provider";
import {
  getConversations,
  deleteConversation,
  type ConversationFilters as ConversationFilterParams,
} from "@/lib/api-client/messaging";
import type { Conversation, Label, TemperatureDefinition } from "@/lib/types/messaging";

interface ConversationListProps {
  conversations: Conversation[];
  selectedId: number | null;
  allLabels: Label[];
  temperatureConfig?: TemperatureDefinition[];
  section?: string;
  tenantId?: number;
  onSelect: (id: number) => void;
  onConversationsChange: (conversations: Conversation[]) => void;
  onDeleteConversation?: (id: number) => void;
  onLabelCreated?: (label: Label) => void;
  onLabelDeleted?: (labelId: number) => void;
}

type SectionValue = "all" | "sale" | "unattended";

export function ConversationList({
  conversations,
  selectedId,
  allLabels,
  temperatureConfig = [],
  section = "all",
  tenantId,
  onSelect,
  onConversationsChange,
  onDeleteConversation,
  onLabelCreated,
  onLabelDeleted,
}: ConversationListProps) {
  const lastEvent = useMessagingEvent();
  const emitEvent = useMessagingEmit();
  const sectionFilter = (section === "sale" || section === "unattended" ? section : "all") as SectionValue;
  const [activeFilters, setActiveFilters] = useState<ActiveFilters>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  // Refs for transient pagination state (rerender-use-ref-transient-values)
  const loadingMoreRef = useRef(false);
  const currentPageRef = useRef(1);
  const hasMoreRef = useRef(true);
  const listRef = useRef<HTMLDivElement>(null);
  const sectionFilterRef = useRef(sectionFilter);
  sectionFilterRef.current = sectionFilter;
  const activeFiltersRef = useRef(activeFilters);
  activeFiltersRef.current = activeFilters;
  const searchQueryRef = useRef(searchQuery);
  searchQueryRef.current = searchQuery;
  const conversationsRef = useRef(conversations);
  conversationsRef.current = conversations;

  const buildParams = useCallback(
    (section: SectionValue, filters: ActiveFilters, search?: string): ConversationFilterParams => {
      const params: ConversationFilterParams = {};
      if (tenantId) params.tenant_id = tenantId;
      if (section === "sale") params.stage = "sale";
      if (section === "unattended") params.conversation_type = "unattended";
      if (filters.label) params.label = filters.label;
      if (filters.temperature) params.temperature = filters.temperature;
      if (filters.dateRange) {
        params.created_after = filters.dateRange.from;
        params.created_before = filters.dateRange.to;
      }
      if (filters.unread) params.unread = "true";
      const trimmed = search?.trim();
      if (trimmed) params.search = trimmed;
      return params;
    },
    [tenantId]
  );

  const searchAbortRef = useRef<AbortController | null>(null);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchConversations = useCallback(
    async (params: ConversationFilterParams, signal?: AbortSignal) => {
      setLoading(true);
      currentPageRef.current = 1;
      hasMoreRef.current = true;
      try {
        const data = await getConversations({ ...params, page: 1 }, signal);
        onConversationsChange(data.data ?? []);
        hasMoreRef.current = data.meta?.next_page != null;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        console.error("Error fetching conversations:", error);
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [onConversationsChange]
  );

  const debouncedSearch = useCallback(
    (search: string) => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
      searchDebounceRef.current = setTimeout(() => {
        searchAbortRef.current?.abort();
        const controller = new AbortController();
        searchAbortRef.current = controller;
        const params = buildParams(sectionFilterRef.current, activeFiltersRef.current, search);
        fetchConversations(params, controller.signal);
      }, 300);
    },
    [buildParams, fetchConversations]
  );

  // Cleanup pending debounce/abort on unmount
  useEffect(() => {
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
      searchAbortRef.current?.abort();
    };
  }, []);

  // Load more conversations on scroll (rerender-move-effect-to-event)
  const loadMoreConversations = useCallback(() => {
    // js-early-exit: skip if already loading or no more pages
    if (loadingMoreRef.current || !hasMoreRef.current) return;

    loadingMoreRef.current = true;
    setLoadingMore(true);
    const nextPage = currentPageRef.current + 1;
    const params = buildParams(sectionFilterRef.current, activeFiltersRef.current, searchQueryRef.current);

    getConversations({ ...params, page: nextPage })
      .then((data) => {
        const newConversations = data.data ?? [];
        if (newConversations.length === 0) {
          hasMoreRef.current = false;
        } else {
          onConversationsChange([...conversationsRef.current, ...newConversations]);
          currentPageRef.current = nextPage;
          hasMoreRef.current = data.meta?.next_page != null;
        }
      })
      .catch((err) => console.error("Error loading more conversations:", err))
      .finally(() => {
        loadingMoreRef.current = false;
        setLoadingMore(false);
      });
  }, [buildParams, onConversationsChange]);

  const handleFiltersChange = useCallback(
    (filters: ActiveFilters) => {
      setActiveFilters(filters);
      fetchConversations(buildParams(sectionFilterRef.current, filters, searchQueryRef.current));
    },
    [fetchConversations, buildParams]
  );

  const handleDelete = useCallback(
    async (id: number) => {
      try {
        await deleteConversation(id, tenantId);
        onConversationsChange(conversationsRef.current.filter((c) => c.id !== id));
        onDeleteConversation?.(id);
        emitEvent({ event: "conversation.deleted", data: { id } });
      } catch (error) {
        console.error("Error deleting conversation:", error);
      }
    },
    [onConversationsChange, onDeleteConversation, emitEvent]
  );

  // Debounced full refetch (fallback for events we can't handle locally)
  const refetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debouncedRefetch = useCallback(() => {
    if (refetchTimerRef.current) clearTimeout(refetchTimerRef.current);
    refetchTimerRef.current = setTimeout(() => {
      const params = buildParams(sectionFilterRef.current, activeFiltersRef.current, searchQueryRef.current);
      currentPageRef.current = 1;
      getConversations({ ...params, page: 1 })
        .then((data) => {
          onConversationsChange(data.data ?? []);
          hasMoreRef.current = data.meta?.next_page != null;
        })
        .catch((err) => console.error("Error refreshing conversations:", err));
    }, 500);
  }, [buildParams, onConversationsChange]);

  // Update conversation list locally on real-time events (avoid full refetch)
  useEffect(() => {
    if (!lastEvent) return;
    const { event, data } = lastEvent;
    const current = conversationsRef.current;

    if (event === "message.created") {
      const convId = Number(data.conversation_id);
      const content = (data.content as string) ?? null;
      const msgType = (data.message_type as string) ?? "incoming";
      const msgStatus = (data.status as string) ?? undefined;
      const createdAt = data.created_at ?? new Date().toISOString();
      const attachments = Array.isArray(data.attachments) && data.attachments.length > 0
        ? data.attachments[0] : null;

      onConversationsChange(
        current.map((c) => c.id === convId ? {
          ...c,
          last_message: {
            content,
            message_type: msgType as Conversation["last_message"] extends { message_type: infer T } ? T : string,
            status: msgStatus as Conversation["last_message"] extends { status: infer S } ? S : string,
            attachment_type: attachments ? (attachments as Record<string, unknown>).file_type as string ?? null : null,
            created_at: createdAt as string | number,
          } as Conversation["last_message"],
          last_message_at: createdAt as string | number,
          unread_count: msgType === "incoming" ? (c.unread_count ?? 0) + 1 : c.unread_count,
        } : c).sort((a, b) => {
          const aTime = a.last_message_at ? new Date(typeof a.last_message_at === "number" ? a.last_message_at * 1000 : a.last_message_at).getTime() : 0;
          const bTime = b.last_message_at ? new Date(typeof b.last_message_at === "number" ? b.last_message_at * 1000 : b.last_message_at).getTime() : 0;
          return bTime - aTime;
        })
      );
      // If conversation not in list, do a debounced full refetch
      if (!current.some((c) => c.id === convId)) {
        debouncedRefetch();
      }
    } else if (event === "message.updated" && data.status) {
      const convId = Number(data.conversation_id);
      const newStatus = data.status as string;
      onConversationsChange(
        current.map((c) => {
          if (c.id !== convId || !c.last_message) return c;
          return { ...c, last_message: { ...c.last_message, status: newStatus } as typeof c.last_message };
        })
      );
    } else if (event === "conversation.read") {
      const convId = Number(data.id ?? data.conversation_id);
      onConversationsChange(
        current.map((c) => c.id === convId ? { ...c, unread_count: 0 } : c)
      );
    } else if (event === "conversation.labels_updated") {
      const convId = Number(data.conversation_id);
      const labels = Array.isArray(data.labels) ? data.labels : [];
      onConversationsChange(
        current.map((c) => c.id === convId ? { ...c, labels } : c)
      );
    } else if (
      event === "conversation.created" ||
      event === "conversation.updated" ||
      event === "conversation.status_changed"
    ) {
      debouncedRefetch();
    }

    return () => {
      if (refetchTimerRef.current) clearTimeout(refetchTimerRef.current);
    };
  }, [lastEvent, onConversationsChange, debouncedRefetch]);

  // Scroll detection for infinite scroll (client-passive-event-listeners)
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;

    const handleScroll = () => {
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 200) {
        loadMoreConversations();
      }
    };

    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, [loadMoreConversations]);

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
            onChange={(e) => {
              const value = e.target.value;
              setSearchQuery(value);
              debouncedSearch(value);
            }}
            className="pl-9 h-9 text-sm rounded-full bg-muted/50 border-0 focus-visible:ring-1 focus-visible:ring-primary/30"
          />
        </div>
      </div>

      {/* Filters */}
      <ConversationFilters
        allLabels={allLabels}
        filters={activeFilters}
        temperatureConfig={temperatureConfig}
        onChange={handleFiltersChange}
        onLabelCreated={onLabelCreated}
        onLabelDeleted={onLabelDeleted}
        tenantId={tenantId}
      />

      {/* List */}
      <div ref={listRef} className="flex-1 overflow-y-auto">
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
        ) : conversations.length === 0 ? (
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
          <>
            {conversations.map((conversation) => (
              <div key={conversation.id} style={{ contentVisibility: "auto", containIntrinsicSize: "auto 72px" }}>
                <ConversationItem
                  conversation={conversation}
                  isSelected={selectedId === conversation.id}
                  temperatureConfig={temperatureConfig}
                  onClick={() => onSelect(conversation.id)}
                  onDelete={handleDelete}
                />
              </div>
            ))}
            {loadingMore && (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

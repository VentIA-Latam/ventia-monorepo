"use client";

import { useState, useEffect, useLayoutEffect, useRef, useCallback, memo } from "react";
import { flushSync } from "react-dom";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ArrowLeft, MessageSquare, Loader2, Bot, AlertTriangle, MoreVertical, User, Search } from "lucide-react";
import { MessageBubble } from "./message-bubble";
import { MessageComposer } from "./message-composer";
import { TemplatePicker } from "./template-picker";
import { useMessagingEvent } from "./messaging-provider";
import { getMessages, sendMessage, updateConversation, markConversationRead } from "@/lib/api-client/messaging";
import type { Conversation, Message, MessageType, MessageContentAttributes, AttachmentBrief, ContactBrief, AgentBrief } from "@/lib/types/messaging";
import { getInitials, getDateSeparatorLabel, parseTimestamp } from "@/lib/utils/messaging";

function mapWebSocketAttachments(raw: unknown): AttachmentBrief[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((att: Record<string, unknown>) => ({
    id: String(att.id ?? ""),
    file_type: (att.file_type as string) ?? null,
    file_url: (att.data_url as string) ?? null,
    data_url: (att.data_url as string) ?? null,
    filename: (att.filename as string) ?? null,
    file_size: (att.file_size as number) ?? null,
    extension: (att.extension as string) ?? null,
    coordinates_lat: (att.coordinates_lat as number) ?? null,
    coordinates_long: (att.coordinates_long as number) ?? null,
    meta: (att.meta as Record<string, unknown>) ?? null,
  }));
}

function mapWebSocketSender(raw: unknown): ContactBrief | AgentBrief | null {
  if (!raw || typeof raw !== "object") return null;
  const s = raw as Record<string, unknown>;
  return {
    id: Number(s.id ?? 0),
    name: (s.name as string) ?? null,
    ...("phone_number" in s ? { phone_number: (s.phone_number as string) ?? null } : {}),
    ...("email" in s ? { email: (s.email as string) ?? null } : {}),
  } as ContactBrief | AgentBrief;
}

const MESSAGE_ITEM_STYLE = {};

interface MessageViewProps {
  conversation: Conversation | null;
  tenantId?: number;
  onBack?: () => void;
  onOpenInfo?: () => void;
  onConversationUpdate?: (updated: Conversation) => void;
}

export const MessageView = memo(function MessageView({ conversation, tenantId, onBack, onOpenInfo, onConversationUpdate }: MessageViewProps) {
  const lastEvent = useMessagingEvent();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const scrollBehaviorRef = useRef<false | "instant" | "smooth">(false);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const isLoadingPreviousRef = useRef(false);
  // Track if we should stay pinned to the bottom
  const isPinnedToBottomRef = useRef(true);
  // O(1) dedup for incoming WS messages
  const messageIdsRef = useRef(new Set<string>());
  // Stable ref for loadOlderMessages to avoid scroll listener re-attachment
  const loadOlderRef = useRef<() => void>(() => {});

  // Load messages when conversation changes
  useEffect(() => {
    if (!conversation) {
      setMessages([]);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setHasMore(true);
    messageIdsRef.current = new Set<string>();

    getMessages(conversation.id, { tenantId })
      .then((data) => {
        if (!cancelled) {
          const msgs = data.data ?? [];
          messageIdsRef.current = new Set(msgs.map((m) => String(m.id)));
          scrollBehaviorRef.current = "instant";
          setMessages(msgs);
          setHasMore(Boolean(data.meta?.has_more));
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error("Error loading messages:", err);
        if (!cancelled) setLoading(false);
      });

    // Mark as read (non-blocking, with logging for diagnostics)
    markConversationRead(conversation.id, tenantId)
      .then(() => console.log(`[mark-read] Conversation ${conversation.id} marked as read`))
      .catch((err) => console.error(`[mark-read] FAILED for conversation ${conversation.id}:`, err));

    return () => {
      cancelled = true;
    };
  }, [conversation?.id]);

  // Append new messages from WebSocket events
  useEffect(() => {
    if (!lastEvent || !conversation) return;
    if (lastEvent.event !== "message.created") return;

    const msgData = lastEvent.data;
    if (String(msgData.conversation_id) !== String(conversation.id)) return;

    const msgId = String(msgData.id);

    // Dedup BEFORE entering setMessages so React StrictMode / double-invocations
    // of the updater don't discard the first append on the second run.
    if (messageIdsRef.current.has(msgId)) return;
    messageIdsRef.current.add(msgId);

    const msgType = (msgData.message_type as string) ?? "incoming";
    const rawCreatedAt = msgData.created_at ?? new Date().toISOString();
    const createdAt = typeof rawCreatedAt === "number" || typeof rawCreatedAt === "string"
      ? rawCreatedAt
      : new Date().toISOString();
    const wsAttachments = mapWebSocketAttachments(msgData.attachments);
    const wsSender = mapWebSocketSender(msgData.sender);

    setMessages((prev) => {
      if (msgType === "outgoing") {
        const lastTempIdx = prev.findLastIndex((m) => String(m.id).startsWith("temp-"));
        if (lastTempIdx >= 0) {
          const tempMsg = prev[lastTempIdx];
          const updated = [...prev];
          updated[lastTempIdx] = {
            id: msgId,
            content: (msgData.content as string) ?? "",
            message_type: msgType as MessageType,
            content_attributes: (msgData.content_attributes as MessageContentAttributes) ?? undefined,
            sender: wsSender,
            attachments: wsAttachments.length > 0 ? wsAttachments : tempMsg.attachments,
            created_at: createdAt,
          };
          return updated;
        }
      }

      return [...prev, {
        id: msgId,
        content: (msgData.content as string) ?? "",
        message_type: msgType as MessageType,
        content_attributes: (msgData.content_attributes as MessageContentAttributes) ?? undefined,
        sender: wsSender,
        attachments: wsAttachments,
        created_at: createdAt,
      }];
    });

    // Only auto-scroll if user is near the bottom — don't pull them away from reading history
    if (isPinnedToBottomRef.current) {
      scrollBehaviorRef.current = "smooth";
    }

    // Re-mark as read so incoming messages don't show unread badge while viewing
    if (msgType === "incoming") {
      markConversationRead(conversation.id, tenantId).catch((err) =>
        console.error("[mark-read] Re-mark failed:", err)
      );
    }
  }, [lastEvent, conversation?.id]);

  // Auto-scroll to bottom for new messages / initial load (NOT for load-older — handled by flushSync)
  useLayoutEffect(() => {
    if (!scrollBehaviorRef.current) return;
    const behavior = scrollBehaviorRef.current;
    scrollBehaviorRef.current = false;

    const container = scrollContainerRef.current;
    if (!container) return;

    if (behavior === "instant") {
      requestAnimationFrame(() => {
        container.scrollTop = container.scrollHeight;
      });
    } else {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // ResizeObserver: when content grows (images load, maps render) keep scroll at bottom
  useEffect(() => {
    const content = contentRef.current;
    const container = scrollContainerRef.current;
    if (!content || !container) return;

    const observer = new ResizeObserver(() => {
      if (isPinnedToBottomRef.current && !isLoadingPreviousRef.current) {
        container.scrollTop = container.scrollHeight;
      }
    });

    observer.observe(content);
    return () => observer.disconnect();
  }, [conversation?.id]);

  // Load older messages — Chatwoot fetchPreviousMessages pattern adapted to React.
  // Uses flushSync to commit DOM synchronously, then restores scroll in the SAME
  // call stack — no timing gap, no auto-trigger cascade from scroll events.
  const loadOlderMessages = useCallback(async () => {
    if (!conversation || isLoadingPreviousRef.current || !hasMore) return;

    const container = scrollContainerRef.current;
    if (!container) return;

    const oldestId = messages[0]?.id;
    if (!oldestId || String(oldestId).startsWith("temp-")) return;

    // Chatwoot: setScrollParams — save scroll state before fetch
    const savedHeight = container.scrollHeight;
    const savedScrollTop = container.scrollTop;
    isLoadingPreviousRef.current = true;
    setLoadingMore(true);

    try {
      const data = await getMessages(conversation.id, { before: Number(oldestId), tenantId });
      const olderMessages = data.data ?? [];

      olderMessages.forEach((m) => messageIdsRef.current.add(String(m.id)));

      if (olderMessages.length === 0) {
        setHasMore(false);
      } else {
        // flushSync: commit DOM synchronously (like Vue's nextTick in Chatwoot)
        // This lets us restore scroll in the SAME call stack — no layout effect needed
        flushSync(() => {
          setMessages((prev) => [...olderMessages, ...prev]);
          setHasMore(Boolean(data.meta?.has_more));
        });

        // DOM is now updated — restore scroll position immediately (Chatwoot pattern)
        const heightDifference = container.scrollHeight - savedHeight;
        container.scrollTop = savedScrollTop + heightDifference;
      }
    } catch (err) {
      console.error("Error loading older messages:", err);
    } finally {
      isLoadingPreviousRef.current = false;
      setLoadingMore(false);
    }
  }, [conversation?.id, messages, hasMore, tenantId]);

  // Keep stable ref for scroll handler (avoids re-attaching listener on every render)
  loadOlderRef.current = loadOlderMessages;

  // Scroll event handler: load older messages on scroll up + track pinned state
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || !conversation || loading) return;

    const handleScroll = () => {
      if (isLoadingPreviousRef.current) return;

      // Track if user is near the bottom (within 150px)
      const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
      isPinnedToBottomRef.current = distanceFromBottom < 150;

      // Load older messages when near the top — calls through stable ref
      if (container.scrollTop < 100) {
        loadOlderRef.current();
      }
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, [conversation?.id, loading]);

  // Send message
  const handleSend = useCallback(
    async (content: string, file?: File) => {
      if (!conversation) return;

      // Build temp attachment preview for optimistic UI
      const tempAttachments: AttachmentBrief[] = [];
      let previewUrl: string | null = null;
      if (file) {
        previewUrl = (file.type.startsWith("image/") || file.type.startsWith("audio/"))
          ? URL.createObjectURL(file)
          : null;
        let fileType: string = "file";
        if (file.type.startsWith("image/")) fileType = "image";
        else if (file.type.startsWith("audio/")) fileType = "audio";
        else if (file.type.startsWith("video/")) fileType = "video";

        tempAttachments.push({
          id: `temp-att-${Date.now()}`,
          file_type: fileType,
          file_url: previewUrl,
          filename: file.name,
          file_size: file.size,
        });
      }

      const tempMessage: Message = {
        id: `temp-${Date.now()}`,
        content,
        message_type: "outgoing",
        sender: null,
        attachments: tempAttachments,
        created_at: new Date().toISOString(),
      };

      scrollBehaviorRef.current = "smooth";
      messageIdsRef.current.add(String(tempMessage.id));
      setMessages((prev) => [...prev, tempMessage]);

      try {
        const result = await sendMessage(conversation.id, { content }, file, tenantId);
        if (result && typeof result === "object" && "id" in result) {
          const realId = String((result as Message).id);
          messageIdsRef.current.add(realId);
          setMessages((prev) =>
            prev.map((m) =>
              m.id === tempMessage.id || String(m.id) === realId ? (result as Message) : m
            )
          );
        }
      } catch (err) {
        console.error("Error sending message:", err);
      } finally {
        if (previewUrl) URL.revokeObjectURL(previewUrl);
      }
    },
    [conversation?.id, tenantId]
  );

  // Toggle AI agent
  const handleToggleAI = useCallback(
    async (checked: boolean) => {
      if (!conversation) return;
      const updated = { ...conversation, ai_agent_enabled: checked };
      onConversationUpdate?.(updated);

      try {
        await updateConversation(conversation.id, { ai_agent_enabled: checked }, tenantId);
      } catch (err) {
        console.error("Error toggling AI agent:", err);
        onConversationUpdate?.(conversation);
      }
    },
    [conversation, onConversationUpdate, tenantId]
  );

  // No conversation selected
  if (!conversation) {
    return (
      <div className="flex-1 flex items-center justify-center bg-muted/20">
        <EmptyState
          icon={<MessageSquare className="h-8 w-8" />}
          title="Selecciona una conversación"
          description="Elige una conversación de la lista para ver los mensajes."
        />
      </div>
    );
  }

  const contact = conversation.contact;

  return (
    <div className="flex-1 flex flex-col h-full min-h-0 min-w-0 overflow-hidden">
      {/* Header — WhatsApp style with bg-muted/30 */}
      <div className="px-4 py-2.5 bg-muted/30 flex items-center gap-3 shrink-0 border-b border-border/30">
        {onBack && (
          <Button variant="ghost" size="icon" className="shrink-0 md:hidden h-8 w-8" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
        )}

        <Avatar className="h-10 w-10 shrink-0 cursor-pointer" onClick={onOpenInfo}>
          <AvatarFallback className="text-sm bg-muted">
            {getInitials(contact?.name)}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0 cursor-pointer" onClick={onOpenInfo}>
          <p className="text-[15px] font-medium truncate">
            {contact?.name || contact?.phone_number || "Sin nombre"}
          </p>
          <p className="text-xs text-muted-foreground truncate">
            {contact?.phone_number || contact?.email || ""}
          </p>
        </div>

        {/* Search icon (visual, no functionality yet) */}
        <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8 text-muted-foreground">
          <Search className="h-5 w-5" />
        </Button>

        {/* 3-dot menu — WhatsApp style */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8 text-muted-foreground">
              <MoreVertical className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {/* AI toggle */}
            <div className="flex items-center justify-between px-2 py-1.5">
              <div className="flex items-center gap-2">
                <Bot className={`h-4 w-4 ${conversation.ai_agent_enabled ? "text-primary" : "text-muted-foreground"}`} />
                <span className="text-sm">Agente IA</span>
              </div>
              <Switch
                checked={conversation.ai_agent_enabled}
                onCheckedChange={handleToggleAI}
                className="scale-75"
              />
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onOpenInfo}>
              <User className="h-4 w-4 mr-2" />
              Información del contacto
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Messages — WhatsApp style with chat wallpaper */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto overflow-x-hidden px-4 md:px-16 py-3 min-h-0 min-w-0 overscroll-y-contain"
        style={{ backgroundImage: "url('/images/fondo-conversacion.png')", backgroundRepeat: "repeat" }}
      >
        <div ref={contentRef} className="space-y-1 max-w-full">
          {!hasMore && !loading && messages.length > 0 && (
            <div className="flex justify-center py-4">
              <p className="text-xs text-muted-foreground/60">
                Inicio de la conversación
              </p>
            </div>
          )}

          {loadingMore && (
            <div className="flex justify-center py-2">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {loading ? (
            <div className="space-y-3 py-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className={`flex ${i % 2 === 0 ? "justify-start" : "justify-end"}`}>
                  <Skeleton className={`h-10 rounded-lg ${i % 2 === 0 ? "w-56" : "w-40"}`} />
                </div>
              ))}
            </div>
          ) : messages.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-sm text-muted-foreground">No hay mensajes aún</p>
            </div>
          ) : (
            messages.map((msg, i) => {
              const msgDate = parseTimestamp(msg.created_at);
              const prevDate = i > 0 ? parseTimestamp(messages[i - 1].created_at) : null;
              const showSeparator = msgDate && (
                !prevDate ||
                msgDate.getFullYear() !== prevDate.getFullYear() ||
                msgDate.getMonth() !== prevDate.getMonth() ||
                msgDate.getDate() !== prevDate.getDate()
              );

              return (
                <div key={msg.id} data-msg-id={msg.id}>
                  {showSeparator ? (
                    <div className="flex justify-center my-3">
                      <span className="text-xs text-muted-foreground bg-background/90 border rounded-lg px-3 py-1 shadow-sm">
                        {getDateSeparatorLabel(msg.created_at)}
                      </span>
                    </div>
                  ) : null}
                  <div style={MESSAGE_ITEM_STYLE}>
                    <MessageBubble message={msg} />
                  </div>
                </div>
              );
            })
          )}

          {/* Scroll anchor */}
          <div ref={bottomRef} className="h-px" />
        </div>
      </div>

      {/* 24-hour window warning */}
      {conversation.can_reply === false && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-warning-bg border-t border-warning/30 text-warning text-sm">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <p className="flex-1">La ventana de 24 horas ha expirado. Solo puedes enviar plantillas de WhatsApp.</p>
        </div>
      )}

      {/* Composer */}
      <MessageComposer
        onSend={handleSend}
        disabled={loading || conversation.can_reply === false}
        onOpenTemplates={
          conversation.inbox?.channel_type === "Channel::Whatsapp"
            ? () => setShowTemplatePicker(true)
            : undefined
        }
      />

      {/* Template picker dialog */}
      {conversation.inbox?.channel_type === "Channel::Whatsapp" && conversation.inbox_id && (
        <TemplatePicker
          open={showTemplatePicker}
          onOpenChange={setShowTemplatePicker}
          inboxId={conversation.inbox_id}
          conversationId={conversation.id}
          onSent={() => {
            // Refresh messages after sending template
            getMessages(conversation.id, { tenantId }).then((data) => {
              const msgs = data.data ?? [];
              messageIdsRef.current = new Set(msgs.map((m) => String(m.id)));
              scrollBehaviorRef.current = "smooth";
              setMessages(msgs);
            }).catch((err) => console.error("Error refreshing messages:", err));
          }}
        />
      )}
    </div>
  );
})

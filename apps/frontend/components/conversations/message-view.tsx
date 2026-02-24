"use client";

import { useState, useEffect, useLayoutEffect, useRef, useCallback } from "react";
// useLayoutEffect: scroll before paint | ResizeObserver: re-scroll when content grows (images load)
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
import { ArrowLeft, MessageSquare, Loader2, Bot, AlertTriangle, MoreVertical, User, Search, FileText } from "lucide-react";
import { MessageBubble } from "./message-bubble";
import { MessageComposer } from "./message-composer";
import { TemplatePicker } from "./template-picker";
import { useMessaging } from "./messaging-provider";
import { getMessages, sendMessage, updateConversation, markConversationRead } from "@/lib/api-client/messaging";
import type { Conversation, Message, MessageType, AttachmentBrief, ContactBrief, AgentBrief } from "@/lib/types/messaging";

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

interface MessageViewProps {
  conversation: Conversation | null;
  onBack?: () => void;
  onOpenInfo?: () => void;
  onConversationUpdate?: (updated: Conversation) => void;
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

export function MessageView({ conversation, onBack, onOpenInfo, onConversationUpdate }: MessageViewProps) {
  const { lastEvent } = useMessaging();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const scrollBehaviorRef = useRef<false | "instant" | "smooth">(false);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  // Chatwoot pattern: track scroll state before loading older messages
  const heightBeforeLoadRef = useRef(0);
  const scrollTopBeforeLoadRef = useRef(0);
  const isLoadingPreviousRef = useRef(false);
  // Track if we should stay pinned to the bottom
  const isPinnedToBottomRef = useRef(true);

  // Load messages when conversation changes
  useEffect(() => {
    if (!conversation) {
      setMessages([]);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setPage(1);
    setHasMore(true);

    getMessages(conversation.id)
      .then((data) => {
        if (!cancelled) {
          scrollBehaviorRef.current = "instant";
          setMessages(data.data ?? []);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error("Error loading messages:", err);
        if (!cancelled) setLoading(false);
      });

    // Mark as read (non-blocking, with logging for diagnostics)
    markConversationRead(conversation.id)
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
    const msgType = (msgData.message_type as string) ?? "incoming";

    setMessages((prev) => {
      if (prev.some((m) => String(m.id) === msgId)) return prev;

      const rawCreatedAt = msgData.created_at ?? new Date().toISOString();
      const createdAt = typeof rawCreatedAt === "number" || typeof rawCreatedAt === "string"
        ? rawCreatedAt
        : new Date().toISOString();

      const wsAttachments = mapWebSocketAttachments(msgData.attachments);
      const wsSender = mapWebSocketSender(msgData.sender);

      if (msgType === "outgoing") {
        const lastTempIdx = prev.findLastIndex((m) => String(m.id).startsWith("temp-"));
        if (lastTempIdx >= 0) {
          const tempMsg = prev[lastTempIdx];
          const updated = [...prev];
          updated[lastTempIdx] = {
            id: msgId,
            content: (msgData.content as string) ?? "",
            message_type: msgType as MessageType,
            sender: wsSender,
            // Keep temp preview attachments if WS broadcast arrived before attachment was created
            attachments: wsAttachments.length > 0 ? wsAttachments : tempMsg.attachments,
            created_at: createdAt,
          };
          return updated;
        }
      }

      const newMsg: Message = {
        id: msgId,
        content: (msgData.content as string) ?? "",
        message_type: msgType as MessageType,
        sender: wsSender,
        attachments: wsAttachments,
        created_at: createdAt,
      };
      return [...prev, newMsg];
    });

    scrollBehaviorRef.current = "smooth";

    // Re-mark as read so incoming messages don't show unread badge while viewing
    if (msgType === "incoming") {
      markConversationRead(conversation.id).catch((err) =>
        console.error("[mark-read] Re-mark failed:", err)
      );
    }
  }, [lastEvent, conversation?.id]);

  // Scroll to bottom after DOM commits
  useLayoutEffect(() => {
    if (!scrollBehaviorRef.current) return;
    const behavior = scrollBehaviorRef.current;
    scrollBehaviorRef.current = false;

    const container = scrollContainerRef.current;
    if (!container) return;

    isPinnedToBottomRef.current = true;

    if (behavior === "instant") {
      // Use rAF so browser has completed layout (images with min-height are measured)
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

  // Load older messages (Chatwoot pattern: save/restore scroll position)
  const loadOlderMessages = useCallback(async () => {
    if (!conversation || loadingMore || !hasMore) return;

    const container = scrollContainerRef.current;
    if (!container) return;

    // Save scroll state before fetch (Chatwoot: setScrollParams)
    heightBeforeLoadRef.current = container.scrollHeight;
    scrollTopBeforeLoadRef.current = container.scrollTop;
    isLoadingPreviousRef.current = true;
    setLoadingMore(true);

    try {
      const nextPage = page + 1;
      const data = await getMessages(conversation.id, nextPage);
      const olderMessages = data.data ?? [];

      if (olderMessages.length === 0) {
        setHasMore(false);
      } else {
        setMessages((prev) => [...olderMessages, ...prev]);
        setPage(nextPage);

        // Restore scroll position after DOM update (Chatwoot pattern)
        requestAnimationFrame(() => {
          const heightDifference = container.scrollHeight - heightBeforeLoadRef.current;
          container.scrollTop = scrollTopBeforeLoadRef.current + heightDifference;
          isLoadingPreviousRef.current = false;
        });
      }
    } catch (err) {
      console.error("Error loading older messages:", err);
      isLoadingPreviousRef.current = false;
    } finally {
      setLoadingMore(false);
    }
  }, [conversation?.id, page, loadingMore, hasMore]);

  // Scroll event handler: load older messages on scroll up + track pinned state
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || !conversation || loading) return;

    const handleScroll = () => {
      if (isLoadingPreviousRef.current) return;

      // Track if user is near the bottom (within 150px)
      const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
      isPinnedToBottomRef.current = distanceFromBottom < 150;

      // Load older messages when near the top
      if (container.scrollTop < 100 && hasMore && !loadingMore) {
        loadOlderMessages();
      }
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, [conversation?.id, loading, loadOlderMessages, hasMore, loadingMore]);

  // Send message
  const handleSend = useCallback(
    async (content: string, file?: File) => {
      if (!conversation) return;

      // Build temp attachment preview for optimistic UI
      const tempAttachments: AttachmentBrief[] = [];
      if (file) {
        const previewUrl = file.type.startsWith("image/") ? URL.createObjectURL(file) : null;
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
      setMessages((prev) => [...prev, tempMessage]);

      try {
        const result = await sendMessage(conversation.id, { content }, file);
        if (result && typeof result === "object" && "id" in result) {
          const realId = String((result as Message).id);
          setMessages((prev) =>
            prev.map((m) =>
              m.id === tempMessage.id || String(m.id) === realId ? (result as Message) : m
            )
          );
        }
      } catch (err) {
        console.error("Error sending message:", err);
      }
    },
    [conversation?.id]
  );

  // Toggle AI agent
  const handleToggleAI = useCallback(
    async (checked: boolean) => {
      if (!conversation) return;
      const updated = { ...conversation, ai_agent_enabled: checked };
      onConversationUpdate?.(updated);

      try {
        await updateConversation(conversation.id, { ai_agent_enabled: checked });
      } catch (err) {
        console.error("Error toggling AI agent:", err);
        onConversationUpdate?.(conversation);
      }
    },
    [conversation, onConversationUpdate]
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
    <div className="flex-1 flex flex-col h-full">
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
        className="flex-1 overflow-y-auto px-4 md:px-16 py-3"
        style={{ backgroundImage: "url('/images/fondo-conversacion.png')", backgroundRepeat: "repeat" }}
      >
        <div ref={contentRef} className="space-y-1">
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
            messages.map((msg) => (
              <div key={msg.id} style={{ overflowAnchor: "none" }}>
                <MessageBubble message={msg} />
              </div>
            ))
          )}

          {/* Scroll anchor — only element with overflow-anchor: auto */}
          <div ref={bottomRef} className="h-px" style={{ overflowAnchor: "auto" }} />
        </div>
      </div>

      {/* 24-hour window warning + template CTA */}
      {conversation.can_reply === false && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-warning-bg border-t border-warning/30 text-warning text-sm">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <p className="flex-1">La ventana de 24 horas ha expirado. Envía una plantilla para reabrir la conversación.</p>
          {conversation.inbox?.channel_type === "Channel::Whatsapp" && (
            <Button
              size="sm"
              variant="outline"
              className="shrink-0 text-xs border-warning/40 text-warning hover:bg-warning/10"
              onClick={() => setShowTemplatePicker(true)}
            >
              <FileText className="h-3.5 w-3.5 mr-1.5" />
              Enviar plantilla
            </Button>
          )}
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
            getMessages(conversation.id).then((data) => {
              scrollBehaviorRef.current = "smooth";
              setMessages(data.data ?? []);
            }).catch((err) => console.error("Error refreshing messages:", err));
          }}
        />
      )}
    </div>
  );
}

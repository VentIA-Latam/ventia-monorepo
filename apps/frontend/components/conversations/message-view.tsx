"use client";

import { useState, useEffect, useRef, useCallback } from "react";
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
import { useMessaging } from "./messaging-provider";
import { getMessages, sendMessage, updateConversation } from "@/lib/api-client/messaging";
import type { Conversation, Message, MessageType } from "@/lib/types/messaging";

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
  const sentinelRef = useRef<HTMLDivElement>(null);

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
          setMessages(data.data ?? []);
          setLoading(false);
          requestAnimationFrame(() => {
            bottomRef.current?.scrollIntoView({ behavior: "instant" });
          });
        }
      })
      .catch((err) => {
        console.error("Error loading messages:", err);
        if (!cancelled) setLoading(false);
      });

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

      if (msgType === "outgoing") {
        const hasTempMsg = prev.some((m) => String(m.id).startsWith("temp-"));
        if (hasTempMsg) {
          const lastTempIdx = prev.findLastIndex((m) => String(m.id).startsWith("temp-"));
          const updated = [...prev];
          updated[lastTempIdx] = {
            id: msgId,
            content: (msgData.content as string) ?? "",
            message_type: msgType as MessageType,
            sender: null,
            attachments: [],
            created_at: createdAt,
          };
          return updated;
        }
      }

      const newMsg: Message = {
        id: msgId,
        content: (msgData.content as string) ?? "",
        message_type: msgType as MessageType,
        sender: null,
        attachments: [],
        created_at: createdAt,
      };
      return [...prev, newMsg];
    });

    requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    });
  }, [lastEvent, conversation?.id]);

  // Load older messages
  const loadOlderMessages = useCallback(async () => {
    if (!conversation || loadingMore || !hasMore) return;

    const container = scrollContainerRef.current;
    if (!container) return;

    const prevHeight = container.scrollHeight;
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

        requestAnimationFrame(() => {
          container.scrollTop = container.scrollHeight - prevHeight;
        });
      }
    } catch (err) {
      console.error("Error loading older messages:", err);
    } finally {
      setLoadingMore(false);
    }
  }, [conversation?.id, page, loadingMore, hasMore]);

  // Intersection observer for infinite scroll up
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !conversation) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore) {
          loadOlderMessages();
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadOlderMessages, hasMore, loadingMore, conversation?.id]);

  // Send message
  const handleSend = useCallback(
    async (content: string) => {
      if (!conversation) return;

      const tempMessage: Message = {
        id: `temp-${Date.now()}`,
        content,
        message_type: "outgoing",
        sender: null,
        attachments: [],
        created_at: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, tempMessage]);

      requestAnimationFrame(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      });

      try {
        const result = await sendMessage(conversation.id, {
          content,
        });
        if (result && typeof result === "object" && "id" in result) {
          setMessages((prev) =>
            prev.map((m) => (m.id === tempMessage.id ? (result as Message) : m))
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
        className="flex-1 overflow-y-auto bg-muted/20 px-4 md:px-16 py-3 space-y-1"
      >
        {/* Sentinel for loading more */}
        <div ref={sentinelRef} className="h-1" />

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
          messages.map((msg) => <MessageBubble key={msg.id} message={msg} />)
        )}

        <div ref={bottomRef} />
      </div>

      {/* 24-hour window warning */}
      {conversation.can_reply === false && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-warning-bg border-t border-warning/30 text-warning text-sm">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <p>La ventana de 24 horas ha expirado. No se pueden enviar mensajes hasta que el contacto responda.</p>
        </div>
      )}

      {/* Composer */}
      <MessageComposer onSend={handleSend} disabled={loading || conversation.can_reply === false} />
    </div>
  );
}

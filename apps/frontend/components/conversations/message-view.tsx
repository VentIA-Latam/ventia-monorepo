"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ArrowLeft, User, MessageSquare, Loader2, Bot, AlertTriangle } from "lucide-react";
import { MessageBubble } from "./message-bubble";
import { MessageComposer } from "./message-composer";
import { useMessaging } from "./messaging-provider";
import { getMessages, sendMessage, updateConversation } from "@/lib/api-client/messaging";
import type { Conversation, Message, MessageType, SendMessagePayload } from "@/lib/types/messaging";

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
          // Scroll to bottom after initial load
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
      // Skip if real message already exists
      if (prev.some((m) => String(m.id) === msgId)) return prev;

      const rawCreatedAt = msgData.created_at ?? new Date().toISOString();
      const createdAt = typeof rawCreatedAt === "number" || typeof rawCreatedAt === "string"
        ? rawCreatedAt
        : new Date().toISOString();

      // For outgoing messages, try to replace the temp message first
      if (msgType === "outgoing") {
        const hasTempMsg = prev.some((m) => String(m.id).startsWith("temp-"));
        if (hasTempMsg) {
          // Replace the last temp message with the real one
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
        // No temp message — fall through to append (e.g., sent from another tab or API)
      }

      // Append message (incoming or outgoing without temp)
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

        // Preserve scroll position
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

      // Optimistic append
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
        // Replace temp message with real one if API returns it
        if (result && typeof result === "object" && "id" in result) {
          setMessages((prev) =>
            prev.map((m) => (m.id === tempMessage.id ? (result as Message) : m))
          );
        }
      } catch (err) {
        console.error("Error sending message:", err);
        // Mark temp message as failed (keep it visible)
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
      <div className="flex-1 flex items-center justify-center">
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
      {/* Header */}
      <div className="px-4 py-3 border-b flex items-center gap-3 shrink-0">
        {onBack && (
          <Button variant="ghost" size="icon" className="shrink-0 md:hidden" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
        )}

        <Avatar className="h-9 w-9 shrink-0">
          <AvatarFallback className="text-xs">
            {getInitials(contact?.name)}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">
            {contact?.name || contact?.phone_number || "Sin nombre"}
          </p>
          <p className="text-xs text-muted-foreground truncate">
            {contact?.phone_number || contact?.email || ""}
          </p>
        </div>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1.5 shrink-0">
                <Bot className={`h-4 w-4 ${conversation.ai_agent_enabled ? "text-primary" : "text-muted-foreground"}`} />
                <Switch
                  checked={conversation.ai_agent_enabled}
                  onCheckedChange={handleToggleAI}
                  className="scale-75"
                />
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>{conversation.ai_agent_enabled ? "IA activada" : "IA desactivada"}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {onOpenInfo && (
          <Button variant="ghost" size="icon" onClick={onOpenInfo}>
            <User className="h-5 w-5" />
          </Button>
        )}
      </div>

      {/* Messages */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto px-4 py-3 space-y-3"
      >
        {/* Sentinel for loading more */}
        <div ref={sentinelRef} className="h-1" />

        {loadingMore && (
          <div className="flex justify-center py-2">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {loading ? (
          <div className="space-y-4 py-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className={`flex ${i % 2 === 0 ? "justify-start" : "justify-end"}`}>
                <Skeleton className={`h-10 rounded-2xl ${i % 2 === 0 ? "w-56" : "w-40"}`} />
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

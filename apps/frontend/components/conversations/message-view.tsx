"use client";

import { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo, memo } from "react";
import { flushSync } from "react-dom";
import { useTheme } from "next-themes";
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
import { ArrowLeft, ArrowDown, MessageSquare, Loader2, Bot, AlertTriangle, MoreVertical, User, Search } from "lucide-react";
import { MessageBubble } from "./message-bubble";
import { MessageComposer } from "./message-composer";
import { TemplatePicker } from "./template-picker";
import { CannedResponsesManagerDialog } from "./canned-responses-manager-dialog";
import { useMessagingEvent, useMessagingReconnect } from "./messaging-provider";
import { getMessages, sendMessage, updateConversation, markConversationRead } from "@/lib/api-client/messaging";
import type { Conversation, Message, MessageType, MessageStatus, MessageContentAttributes, MessageAdditionalAttributes, AttachmentBrief, ContactBrief, AgentBrief, QuotedMessageSnapshot } from "@/lib/types/messaging";
import { MessageSearchPanel } from "./message-search-panel";
import { getInitials, getDateSeparatorLabel, parseTimestamp, getSenderKey } from "@/lib/utils/messaging";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";

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

// Build a minimal Message from the backend quoted snapshot (US-UX-002) so the quote renders
// even when the original message isn't in the loaded window. The id is the real DB id, so
// clicking the quote can still jump to it (loads context around it on demand).
// Cached by snapshot identity so the same snapshot yields a stable Message instance — keeps
// MessageBubble's memo intact for bubbles quoting out-of-window messages.
const snapshotMessageCache = new WeakMap<QuotedMessageSnapshot, Message>();
function snapshotToMessage(snap?: QuotedMessageSnapshot | null): Message | undefined {
  if (!snap) return undefined;
  const cached = snapshotMessageCache.get(snap);
  if (cached) return cached;
  const msg: Message = {
    id: snap.id,
    source_id: null,
    content: snap.content ?? null,
    message_type: snap.message_type ?? null,
    content_attributes: null,
    additional_attributes: null,
    sender: snap.sender_name ? ({ id: 0, name: snap.sender_name } as AgentBrief) : null,
    attachments: snap.attachment_type
      ? [{ id: `quoted-att-${snap.id}`, file_type: snap.attachment_type } as AttachmentBrief]
      : [],
    created_at: null,
  };
  snapshotMessageCache.set(snap, msg);
  return msg;
}

interface MessageViewProps {
  conversation: Conversation | null;
  tenantId?: number;
  targetMessageId?: number | null;
  targetNonce?: number;
  onBack?: () => void;
  onOpenInfo?: () => void;
  onConversationUpdate?: (updated: Conversation) => void;
}

export const MessageView = memo(function MessageView({ conversation, tenantId, targetMessageId, targetNonce, onBack, onOpenInfo, onConversationUpdate }: MessageViewProps) {
  const lastEvent = useMessagingEvent();
  const reconnectedAt = useMessagingReconnect();
  const { userDetails, isAdmin, isSuperAdmin } = useAuth();
  const { toast } = useToast();
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const isDark = mounted && resolvedTheme === "dark";
  const [messages, setMessages] = useState<Message[]>([]);
  const messagesRef = useRef<Message[]>([]);
  messagesRef.current = messages;
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  // Forward pagination: true while there are newer messages below the loaded window (after a
  // jump to an old message). Lets scroll-down load recent messages instead of dead-ending.
  const [hasMoreNewer, setHasMoreNewer] = useState(false);
  const hasMoreNewerRef = useRef(false);
  const loadNewerRef = useRef<() => void>(() => {});
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const scrollBehaviorRef = useRef<false | "instant" | "smooth">(false);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [showCannedManager, setShowCannedManager] = useState(false);
  const canManageCannedResponses = isAdmin || isSuperAdmin;
  const [showActivityMessages, setShowActivityMessages] = useState(true);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [jumpHighlightId, setJumpHighlightId] = useState<string | null>(null);
  const [isJumpMode, setIsJumpMode] = useState(false);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const showScrollDownRef = useRef(false);
  const [isNavigatingToMessage, setIsNavigatingToMessage] = useState(false);
  const isLoadingPreviousRef = useRef(false);
  // Separate guard for forward pagination so an in-flight older load doesn't drop a newer
  // load (and vice-versa). Both use functional setMessages updates, so concurrency is safe.
  const isLoadingNewerRef = useRef(false);
  const isLoadingTargetRef = useRef(false);
  const navigateToMessageRef = useRef<(id: number) => Promise<void>>(async () => {});
  // Track if we should stay pinned to the bottom
  const isPinnedToBottomRef = useRef(true);
  // O(1) dedup for incoming WS messages
  const messageIdsRef = useRef(new Set<string>());
  // Stable ref for loadOlderMessages to avoid scroll listener re-attachment
  const loadOlderRef = useRef<() => void>(() => {});
  // Guard: prevents re-scroll when messages change due to new WS messages
  const scrolledTargetRef = useRef<string | null>(null);
  // Tracks current conversation ID — used to detect stale navigateToMessage calls after await
  const currentConvIdRef = useRef<number | string | undefined>(conversation?.id);
  // Timer del jump-to-message highlight (limpiado en reset por conversation switch).
  // Declarado acá arriba para evitar TDZ con el effect que lo limpia.
  const jumpTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Live ref de `messages` para que loadOlder/loadNewer puedan leer el boundary id
  // sin tener `messages` en sus deps. Sin esto, cada WS msg recreaba el useCallback
  // y reasignaba refs en cada render.

  // Load messages when conversation changes
  useEffect(() => {
    if (!conversation) {
      setMessages([]);
      return;
    }

    const controller = new AbortController();
    setMessages([]);
    setLoading(true);
    setHasMore(true);
    setHasMoreNewer(false);
    messageIdsRef.current = new Set<string>();

    getMessages(conversation.id, { tenantId, signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted) {
          const msgs = data.data ?? [];
          messageIdsRef.current = new Set(msgs.map((m) => String(m.id)));
          scrollBehaviorRef.current = targetMessageId ? false : "instant";
          setMessages(msgs);
          setHasMore(Boolean(data.meta?.has_more));
          setLoading(false);
        }
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        console.error("Error loading messages:", err);
        if (!controller.signal.aborted) {
          setLoading(false);
          toast({ title: "Error al cargar mensajes", description: "Intenta recargar la página", variant: "destructive" });
        }
      });

    markConversationRead(conversation.id, tenantId)
      .then(() => console.log(`[mark-read] Conversation ${conversation.id} marked as read`))
      .catch((err) => console.error(`[mark-read] FAILED for conversation ${conversation.id}:`, err));

    return () => {
      controller.abort();
    };
  }, [conversation?.id]);

  // Refresh messages when WebSocket reconnects (e.g. after sleep/wake)
  useEffect(() => {
    if (!reconnectedAt || !conversation) return;

    // AbortController para que el fetch se cancele de verdad al cambiar de
    // conversación (mirror del patrón del initial load — el `cancelled` flag
    // anterior no cortaba el request en sí, solo el .then).
    const controller = new AbortController();
    getMessages(conversation.id, { tenantId, signal: controller.signal })
      .then((data) => {
        if (controller.signal.aborted) return;
        const msgs = data.data ?? [];
        messageIdsRef.current = new Set(msgs.map((m) => String(m.id)));
        scrollBehaviorRef.current = "instant";
        setMessages(msgs);
        setHasMore(Boolean(data.meta?.has_more));
        setHasMoreNewer(false);
      })
      .catch((err) => {
        if (err?.name === "AbortError") return;
        console.error("[reconnect] Error refreshing messages:", err);
      });

    return () => { controller.abort(); };
  }, [reconnectedAt, conversation?.id, tenantId]);

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

    const wsAdditionalAttributes =
      (msgData.additional_attributes as MessageAdditionalAttributes | undefined) ?? null;

    setMessages((prev) => {
      if (msgType === "outgoing" || msgType === "template") {
        const lastTempIdx = prev.findLastIndex((m) => String(m.id).startsWith("temp-"));
        if (lastTempIdx >= 0) {
          const tempMsg = prev[lastTempIdx];
          const updated = [...prev];
          updated[lastTempIdx] = {
            id: msgId,
            source_id: (msgData.source_id as string) ?? null,
            content: (msgData.content as string) ?? "",
            message_type: msgType as MessageType,
            status: (msgData.status as MessageStatus) ?? undefined,
            content_attributes: (msgData.content_attributes as MessageContentAttributes) ?? undefined,
            additional_attributes: wsAdditionalAttributes ?? tempMsg.additional_attributes ?? null,
            sender: wsSender,
            attachments: wsAttachments.length > 0 ? wsAttachments : tempMsg.attachments,
            created_at: createdAt,
          };
          return updated;
        }
      }

      return [...prev, {
        id: msgId,
        source_id: (msgData.source_id as string) ?? null,
        content: (msgData.content as string) ?? "",
        message_type: msgType as MessageType,
        status: (msgData.status as MessageStatus) ?? undefined,
        content_attributes: (msgData.content_attributes as MessageContentAttributes) ?? undefined,
        additional_attributes: wsAdditionalAttributes,
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

  // Update message from WebSocket events (message.updated):
  // - status (sent → delivered → read)
  // - source_id (US-UX-002): outgoing messages are broadcast on creation with source_id=null,
  //   then the wamid is assigned after Meta confirms and only arrives via this event. Without
  //   merging it here, quoting/replying to a just-sent message can't resolve its source_id.
  useEffect(() => {
    if (!lastEvent || !conversation) return;
    if (lastEvent.event !== "message.updated") return;

    const msgData = lastEvent.data;
    if (String(msgData.conversation_id) !== String(conversation.id)) return;

    const msgId = String(msgData.id);
    setMessages((prev) =>
      prev.map((m) => {
        if (String(m.id) !== msgId) return m;
        const next = { ...m };
        if (msgData.status) next.status = msgData.status as MessageStatus;
        if (msgData.source_id) next.source_id = msgData.source_id as string;
        return next;
      })
    );
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

    const oldestId = messagesRef.current[0]?.id;
    if (!oldestId || String(oldestId).startsWith("temp-")) return;

    // Chatwoot: setScrollParams — save scroll state before fetch
    const savedHeight = container.scrollHeight;
    const savedScrollTop = container.scrollTop;
    isLoadingPreviousRef.current = true;
    setLoadingMore(true);

    try {
      const data = await getMessages(conversation.id, { before: Number(oldestId), tenantId });
      const olderMessages = (data.data ?? []).filter((m) => !messageIdsRef.current.has(String(m.id)));

      olderMessages.forEach((m) => messageIdsRef.current.add(String(m.id)));

      if (olderMessages.length === 0) {
        setHasMore(false);
      } else {
        // flushSync: commit DOM synchronously (like Vue's nextTick in Chatwoot)
        // This lets us restore scroll in the SAME call stack — no layout effect needed
        flushSync(() => {
          setMessages((prev) =>
            [...olderMessages, ...prev].sort(
              (a, b) => (parseTimestamp(a.created_at)?.getTime() ?? 0) - (parseTimestamp(b.created_at)?.getTime() ?? 0)
            )
          );
          setHasMore(Boolean(data.meta?.has_more));
        });

        // DOM is now updated — restore scroll position immediately (Chatwoot pattern)
        const heightDifference = container.scrollHeight - savedHeight;
        container.scrollTop = savedScrollTop + heightDifference;

        // Loading older content means we are NOT at the bottom — unpin unconditionally
        // so ResizeObserver doesn't fight scrollIntoView when seeking a target message
        isPinnedToBottomRef.current = false;
      }
    } catch (err) {
      console.error("Error loading older messages:", err);
    } finally {
      isLoadingPreviousRef.current = false;
      setLoadingMore(false);
    }
  }, [conversation?.id, hasMore, tenantId]);

  // Load newer messages (forward pagination) — used after jumping to an old message so the
  // user can scroll down toward the present. Appends at the bottom; since the user is scrolled
  // mid-history (not pinned), the view stays put while content grows below.
  const loadNewerMessages = useCallback(async () => {
    if (!conversation || isLoadingNewerRef.current || !hasMoreNewer) return;

    // Use the newest persisted id as the cursor — skip optimistic temp messages so a pending
    // (or failed) send at the bottom doesn't block forward pagination.
    const messagesNow = messagesRef.current;
    let newestId: string | number | undefined;
    for (let i = messagesNow.length - 1; i >= 0; i--) {
      if (!String(messagesNow[i].id).startsWith("temp-")) {
        newestId = messagesNow[i].id;
        break;
      }
    }
    if (!newestId) return;

    isLoadingNewerRef.current = true;
    setLoadingMore(true);
    try {
      const data = await getMessages(conversation.id, { after: Number(newestId), tenantId });
      const newer = (data.data ?? []).filter((m) => !messageIdsRef.current.has(String(m.id)));
      newer.forEach((m) => messageIdsRef.current.add(String(m.id)));

      if (newer.length === 0) {
        setHasMoreNewer(false);
      } else {
        setMessages((prev) =>
          [...prev, ...newer].sort(
            (a, b) => (parseTimestamp(a.created_at)?.getTime() ?? 0) - (parseTimestamp(b.created_at)?.getTime() ?? 0)
          )
        );
        setHasMoreNewer(Boolean(data.meta?.has_more));
      }
    } catch (err) {
      console.error("Error loading newer messages:", err);
    } finally {
      isLoadingNewerRef.current = false;
      setLoadingMore(false);
    }
  }, [conversation?.id, hasMoreNewer, tenantId]);

  // Keep stable ref for scroll handler (avoids re-attaching listener on every render)
  loadOlderRef.current = loadOlderMessages;
  loadNewerRef.current = loadNewerMessages;
  hasMoreNewerRef.current = hasMoreNewer;
  // Always reflects the current conversation ID — checked in navigateToMessage after await
  currentConvIdRef.current = conversation?.id;

  // Navigate directly to a target message by loading context around it.
  // Uses flushSync to commit the DOM synchronously, then scrolls directly —
  // avoids the timing gap between setMessages → render → useEffect → scroll.
  const navigateToMessage = useCallback(async (targetId: number) => {
    if (!conversation || isLoadingTargetRef.current) return;
    const capturedConvId = conversation.id;
    isLoadingTargetRef.current = true;
    setIsNavigatingToMessage(true);
    try {
      const data = await getMessages(capturedConvId, { around: targetId, tenantId });
      if (currentConvIdRef.current !== capturedConvId) return;
      const msgs = data.data ?? [];
      if (msgs.length === 0) return;
      messageIdsRef.current = new Set(msgs.map((m) => String(m.id)));
      flushSync(() => {
        setMessages(msgs);
        setHasMore(Boolean(data.meta?.has_more));
        // We loaded a window around an old message — there are (almost certainly) newer
        // messages below. Enable forward pagination; loadNewer self-corrects to false at the end.
        setHasMoreNewer(true);
        setIsJumpMode(true);
      });
      isPinnedToBottomRef.current = false;
      requestAnimationFrame(() => {
        const targetEl = document.querySelector(`[data-msg-id="${targetId}"]`);
        if (targetEl) {
          scrolledTargetRef.current = `${conversation.id}-${targetId}-${targetNonce}`;
          targetEl.scrollIntoView({ behavior: "instant", block: "center" });
          setJumpHighlightId(String(targetId));
          setTimeout(() => setJumpHighlightId(null), 1500);
        }
        isLoadingTargetRef.current = false;
        setIsNavigatingToMessage(false);
      });
    } catch (err) {
      console.error("[navigate-to-message]", err);
      isLoadingTargetRef.current = false;
      setIsNavigatingToMessage(false);
    }
  }, [conversation?.id, tenantId, targetNonce]);

  navigateToMessageRef.current = navigateToMessage;

  // Scroll event handler: load older messages on scroll up + track pinned state
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || !conversation || loading) return;

    const handleScroll = () => {
      // No shared early-return guard: loadOlder/loadNewer each guard themselves with their own
      // ref, so a backward load in flight no longer suppresses a forward load (and vice-versa).
      const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
      const isNearBottom = distanceFromBottom < 150;

      if (isNearBottom && hasMoreNewerRef.current) {
        // Bottom of a jump window, but newer messages exist — load forward instead of
        // treating this as the real bottom (don't pin / don't exit jump mode yet).
        loadNewerRef.current();
      } else {
        isPinnedToBottomRef.current = isNearBottom;
        if (isNearBottom) setIsJumpMode(false);
      }

      // Keep the down-arrow visible while not at the real bottom OR while newer messages remain.
      const shouldShow = !isNearBottom || hasMoreNewerRef.current;
      if (showScrollDownRef.current !== shouldShow) {
        showScrollDownRef.current = shouldShow;
        setShowScrollDown(shouldShow);
      }

      // Load older messages when near the top — calls through stable ref
      if (container.scrollTop < 100) {
        loadOlderRef.current();
      }
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, [conversation?.id, loading]);

  // Quoted reply (US-UX-002): map source_id (wamid) → message to resolve quoted bubbles.
  // The resolved message is passed as a prop per-bubble (computed in the render map below),
  // so MessageBubble's memo only re-renders quoting bubbles whose target actually changed.
  const sourceIdMap = useMemo(() => {
    const map = new Map<string, Message>();
    for (const m of messages) {
      if (m.source_id) map.set(String(m.source_id), m);
    }
    return map;
  }, [messages]);

  // Send message
  const handleSend = useCallback(
    async (content: string, file?: File) => {
      if (!conversation) return;

      const inReplyTo = replyingTo?.source_id ?? null;
      const replyAttrs = inReplyTo ? { in_reply_to: inReplyTo } : undefined;

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
        content_attributes: replyAttrs,
        sender: userDetails
          ? { id: userDetails.id, name: userDetails.name, email: userDetails.email }
          : null,
        attachments: tempAttachments,
        created_at: new Date().toISOString(),
      };

      scrollBehaviorRef.current = "smooth";
      messageIdsRef.current.add(String(tempMessage.id));
      setMessages((prev) => [...prev, tempMessage]);
      setReplyingTo(null);

      try {
        const result = await sendMessage(
          conversation.id,
          { content, ...(replyAttrs ? { content_attributes: replyAttrs } : {}) },
          file,
          tenantId
        );
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
        // Revert the optimistic message to a visible failed state so it isn't left as a
        // phantom "sent" bubble (and doesn't linger at the bottom blocking pagination).
        setMessages((prev) =>
          prev.map((m) => (m.id === tempMessage.id ? { ...m, status: "failed" as MessageStatus } : m))
        );
        toast({ title: "Error al enviar mensaje", description: "Verifica tu conexión e intenta de nuevo", variant: "destructive" });
      } finally {
        if (previewUrl) URL.revokeObjectURL(previewUrl);
      }
    },
    [conversation?.id, tenantId, userDetails, replyingTo]
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
        toast({ title: "Error al cambiar agente IA", variant: "destructive" });
      }
    },
    [conversation, onConversationUpdate, tenantId]
  );

  // Navigate to targetMessageId when provided from conversation list search.
  // For internal search panel clicks, handleResultClick handles scroll directly.
  // targetNonce forces re-execution even when clicking the same result twice.
  useEffect(() => {
    if (!targetMessageId || messages.length === 0) return;

    const key = `${conversation?.id}-${targetMessageId}-${targetNonce}`;
    if (scrolledTargetRef.current === key) return;

    const id = String(targetMessageId);
    const el = document.querySelector(`[data-msg-id="${id}"]`);

    if (!el) {
      if (!isLoadingTargetRef.current) {
        // Marcá scrolled ANTES de dispatchear nav. Sin esto, cada WS msg que
        // llegue durante el await re-dispara el effect, hace un querySelector
        // y queda colgado en el guard `isLoadingTargetRef`. navigateToMessage
        // re-setea esta misma key al completar (no-op).
        scrolledTargetRef.current = key;
        navigateToMessageRef.current(targetMessageId);
      }
      return;
    }

    scrolledTargetRef.current = key;
    isPinnedToBottomRef.current = false;
    requestAnimationFrame(() => {
      el.scrollIntoView({ behavior: "instant", block: "center" });
      setJumpHighlightId(id);
    });
    const timerId = setTimeout(() => setJumpHighlightId(null), 1500);
    return () => clearTimeout(timerId);
  }, [targetMessageId, targetNonce, messages, conversation?.id]);

  // Reset search when conversation changes
  useEffect(() => {
    setIsSearchOpen(false);
    setReplyingTo(null);
    setJumpHighlightId(null);
    setIsJumpMode(false);
    setHasMoreNewer(false);
    setShowScrollDown(false);
    showScrollDownRef.current = false;
    setIsNavigatingToMessage(false);
    scrolledTargetRef.current = null;
    isPinnedToBottomRef.current = false;
    if (jumpTimerRef.current) {
      clearTimeout(jumpTimerRef.current);
      jumpTimerRef.current = null;
    }
  }, [conversation?.id]);

  const handleResultClick = useCallback((messageId: number | string) => {
    scrolledTargetRef.current = null;
    const targetId = Number(messageId);
    const el = document.querySelector(`[data-msg-id="${targetId}"]`);
    if (el) {
      scrolledTargetRef.current = `${conversation?.id}-${targetId}`;
      isPinnedToBottomRef.current = false;
      setIsJumpMode(true);
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      setJumpHighlightId(String(targetId));
      if (jumpTimerRef.current) clearTimeout(jumpTimerRef.current);
      jumpTimerRef.current = setTimeout(() => setJumpHighlightId(null), 1500);
    } else {
      navigateToMessageRef.current(targetId);
    }
  }, [conversation?.id]);

  // Jump to the original message when a quoted preview is clicked (US-UX-002).
  const handleQuotedClick = useCallback(
    (m: Message) => handleResultClick(m.id),
    [handleResultClick]
  );

  const handleToggleSearch = useCallback(() => {
    setIsSearchOpen((prev) => !prev);
  }, []);

  const handleBackToBottom = useCallback(() => {
    if (!conversation) return;
    setIsJumpMode(false);
    setHasMoreNewer(false);
    scrolledTargetRef.current = null;
    setLoading(true);
    setHasMore(true);
    messageIdsRef.current = new Set();
    // Capturá el conv.id antes del await para detectar cambio de conversación
    // mid-fetch; sin esto, el fetch de la conv vieja sobrescribe los mensajes
    // de la nueva.
    const capturedConvId = conversation.id;
    getMessages(conversation.id, { tenantId })
      .then((data) => {
        if (currentConvIdRef.current !== capturedConvId) return;
        const msgs = data.data ?? [];
        messageIdsRef.current = new Set(msgs.map((m) => String(m.id)));
        scrollBehaviorRef.current = "instant";
        setMessages(msgs);
        setHasMore(Boolean(data.meta?.has_more));
      })
      .catch((err) => console.error("[back-to-bottom]", err))
      .finally(() => {
        if (currentConvIdRef.current === capturedConvId) setLoading(false);
      });
  }, [conversation?.id, tenantId]);

  // No conversation selected
  if (!conversation) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background">
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
    <div className="flex-1 flex h-full min-h-0 min-w-0 overflow-hidden relative">
      <div className="flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden">
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

        <Button
          variant="ghost"
          size="icon"
          className={`shrink-0 h-8 w-8 transition-colors ${isSearchOpen ? "text-foreground bg-muted" : "text-muted-foreground"}`}
          onClick={handleToggleSearch}
          aria-label="Buscar en conversación"
        >
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
            <div className="flex items-center justify-between px-2 py-1.5">
              <span className="text-sm">Actividad</span>
              <Switch
                checked={showActivityMessages}
                onCheckedChange={setShowActivityMessages}
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
      <div className="flex-1 relative min-h-0 min-w-0 bg-[#f0f0f0] dark:bg-[#09090b]">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-10 dark:hidden"
          style={{
            zIndex: 0,
            backgroundImage: "url('/images/fondo-wts.webp')",
            backgroundRepeat: "repeat",
            filter: "invert(1) brightness(1.5)",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-60 hidden dark:block"
          style={{
            zIndex: 0,
            backgroundImage: "url('/images/fondo-wts.webp')",
            backgroundRepeat: "repeat",
            filter: "brightness(0.15)",
          }}
        />
        {isNavigatingToMessage && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/50 backdrop-blur-[2px]">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}
        <div
          ref={scrollContainerRef}
          className="relative z-[1] h-full overflow-y-auto overflow-x-hidden overscroll-y-contain"
        >
        <div ref={contentRef} className="space-y-1 max-w-full px-4 md:px-16 py-3">
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
            (showActivityMessages ? messages : messages.filter(m => m.message_type !== "activity")).map((msg, i, arr) => {
              const msgDate = parseTimestamp(msg.created_at);
              const prevDate = i > 0 ? parseTimestamp(arr[i - 1].created_at) : null;
              const showSeparator = msgDate && (
                !prevDate ||
                msgDate.getFullYear() !== prevDate.getFullYear() ||
                msgDate.getMonth() !== prevDate.getMonth() ||
                msgDate.getDate() !== prevDate.getDate()
              );

              // Avatar lateral solo en el último de un cluster del mismo sender (estilo iMessage)
              const next = arr[i + 1];
              const isLastInCluster =
                !next ||
                next.message_type === "activity" ||
                getSenderKey(next) !== getSenderKey(msg);

              const isHighlighted = jumpHighlightId !== null && String(jumpHighlightId) === String(msg.id);

              // Prefer the live loaded message (freshest); fall back to the backend snapshot
              // so quotes to old/unloaded messages still show real content (US-UX-002).
              const quotedSourceId = msg.content_attributes?.in_reply_to;
              const quotedMessage =
                (quotedSourceId ? sourceIdMap.get(String(quotedSourceId)) : undefined) ??
                snapshotToMessage(msg.content_attributes?.quoted);

              return (
                <div
                  key={msg.id}
                  data-msg-id={msg.id}
                >
                  {showSeparator ? (
                    <div className="flex justify-center my-3">
                      <span className="text-xs text-muted-foreground bg-background/90 border rounded-lg px-3 py-1 shadow-sm">
                        {getDateSeparatorLabel(msg.created_at)}
                      </span>
                    </div>
                  ) : null}
                  <div className={`rounded-lg motion-safe:transition-colors motion-safe:duration-300 ${isHighlighted ? "bg-volt/15" : ""}`} style={MESSAGE_ITEM_STYLE}>
                    <MessageBubble
                      message={msg}
                      showAvatar={isLastInCluster}
                      channelType={conversation.inbox?.channel_type}
                      onReply={setReplyingTo}
                      quotedMessage={quotedMessage}
                      onQuotedClick={handleQuotedClick}
                    />
                  </div>
                </div>
              );
            })
          )}

          {/* Scroll anchor */}
          <div ref={bottomRef} className="h-px" />
        </div>
        </div>

        {showScrollDown && (
          <div className="absolute bottom-4 right-4 z-10">
            <Button
              size="icon"
              variant="secondary"
              onClick={isJumpMode ? handleBackToBottom : () => bottomRef.current?.scrollIntoView({ behavior: "smooth" })}
              aria-label="Ir a los más recientes"
              className="h-10 w-10 rounded-full shadow-md border border-border/40"
            >
              <ArrowDown className="h-5 w-5" />
            </Button>
          </div>
        )}
      </div>

      {/* 24-hour window warning */}
      {conversation.can_reply === false && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-warning-bg border-t border-warning/30 text-warning text-sm">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <p className="flex-1">
            {conversation.inbox?.channel_type === "Channel::Whatsapp"
              ? "La ventana de 24 horas ha expirado. Solo puedes enviar plantillas de WhatsApp."
              : "La ventana de 24 horas ha expirado. No es posible responder en este momento."}
          </p>
        </div>
      )}

      {/* Composer */}
      <MessageComposer
        onSend={handleSend}
        disabled={loading || conversation.can_reply === false}
        replyingTo={replyingTo}
        onCancelReply={() => setReplyingTo(null)}
        audioFormat={
          conversation.inbox?.channel_type === "Channel::Instagram" ? "wav" : "mp3"
        }
        onOpenTemplates={
          conversation.inbox?.channel_type === "Channel::Whatsapp"
            ? () => setShowTemplatePicker(true)
            : undefined
        }
        tenantId={tenantId}
        canManageCannedResponses={canManageCannedResponses}
        onManageCannedResponses={
          canManageCannedResponses ? () => setShowCannedManager(true) : undefined
        }
      />

      {/* Canned responses management (admin only) */}
      {canManageCannedResponses && (
        <CannedResponsesManagerDialog
          open={showCannedManager}
          onOpenChange={setShowCannedManager}
          tenantId={tenantId}
        />
      )}

      {/* Template picker dialog */}
      {conversation.inbox?.channel_type === "Channel::Whatsapp" && conversation.inbox_id && (
        <TemplatePicker
          open={showTemplatePicker}
          onOpenChange={setShowTemplatePicker}
          inboxId={conversation.inbox_id}
          conversationId={conversation.id}
          tenantId={tenantId}
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

      {isSearchOpen && (
        <MessageSearchPanel
          conversationId={conversation.id}
          tenantId={tenantId}
          onClose={handleToggleSearch}
          onResultClick={handleResultClick}
        />
      )}
    </div>
  );
})

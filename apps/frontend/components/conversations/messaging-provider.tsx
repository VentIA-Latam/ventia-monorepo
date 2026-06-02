"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import { useActionCable, type ConnectionStatus, type ActionCableEvent } from "@/hooks/use-action-cable";
import { getWsToken, syncUser } from "@/lib/api-client/messaging";

// Split into two contexts so components can subscribe to only what they need.
// Components that only care about events (conversation-list, message-view)
// won't re-render when connectionStatus changes, and vice versa.
const MessagingStatusContext = createContext<ConnectionStatus>("disconnected");
const MessagingEventContext = createContext<ActionCableEvent | null>(null);
const MessagingEmitContext = createContext<(event: ActionCableEvent) => void>(() => {});
// Timestamp (ms) of the most recent WebSocket reconnection; null until the first reconnect.
// Components use this to trigger a data refresh after connection loss (e.g. sleep/wake).
const MessagingReconnectContext = createContext<number | null>(null);

// Inbox filter shared between conversation-list (producer) and app-sidebar (consumer
// for counts). Empty array means "no filter" (all inboxes).
interface InboxFilterValue {
  inboxIds: number[];
  setInboxIds: (ids: number[]) => void;
}
const InboxFilterContext = createContext<InboxFilterValue>({
  inboxIds: [],
  setInboxIds: () => {},
});

/** Subscribe to both status and events (backward compat) */
export function useMessaging() {
  return {
    connectionStatus: useContext(MessagingStatusContext),
    lastEvent: useContext(MessagingEventContext),
  };
}

/** Subscribe to events only — avoids re-render on status changes */
export function useMessagingEvent() {
  return useContext(MessagingEventContext);
}

/** Subscribe to connection status only */
export function useMessagingStatus() {
  return useContext(MessagingStatusContext);
}

/** Emit a synthetic event (e.g. after local-only operations like delete) */
export function useMessagingEmit() {
  return useContext(MessagingEmitContext);
}

/** Returns a timestamp (ms) that updates on each WebSocket reconnection. Use to trigger data refreshes after sleep/wake. */
export function useMessagingReconnect() {
  return useContext(MessagingReconnectContext);
}

/**
 * Shared inbox filter state. The conversations list publishes which inboxes are
 * currently selected so other components (sidebar counts) can stay in sync.
 */
export function useInboxFilter() {
  return useContext(InboxFilterContext);
}

const WS_URL = process.env.NEXT_PUBLIC_MESSAGING_WS_URL || "ws://localhost:3001/cable";

interface MessagingProviderProps {
  children: React.ReactNode;
  tenantId?: number;
}

export function MessagingProvider({ children, tenantId }: MessagingProviderProps) {
  const [token, setToken] = useState<{
    pubsub_token: string;
    account_id: string;
    user_id: string;
  } | null>(null);
  const [lastEvent, setLastEvent] = useState<ActionCableEvent | null>(null);
  const [reconnectedAt, setReconnectedAt] = useState<number | null>(null);
  const [inboxFilterIds, setInboxFilterIdsState] = useState<number[]>([]);
  const setInboxIds = useCallback((ids: number[]) => {
    setInboxFilterIdsState(ids);
  }, []);
  const inboxFilterValue = useMemo<InboxFilterValue>(
    () => ({ inboxIds: inboxFilterIds, setInboxIds }),
    [inboxFilterIds, setInboxIds]
  );

  // Fetch WS token on mount or when tenantId changes
  useEffect(() => {
    let cancelled = false;
    setToken(null); // Reset token to force reconnect

    async function fetchToken() {
      if (!tenantId) return;
      try {
        const data = await getWsToken(tenantId);
        if (!cancelled) setToken(data);
      } catch {
        // Token fetch failed — attempt lazy sync then retry once
        try {
          await syncUser(tenantId);
          const data = await getWsToken(tenantId);
          if (!cancelled) setToken(data);
        } catch (retryErr) {
          console.error("Error getting WS token after sync:", retryErr);
        }
      }
    }

    fetchToken();
    return () => { cancelled = true; };
  }, [tenantId]);

  const emitEvent = useCallback((event: ActionCableEvent) => {
    setLastEvent(event);
  }, []);

  const handleReconnect = useCallback(() => {
    setReconnectedAt(Date.now());
  }, []);

  const { status } = useActionCable({
    url: WS_URL,
    pubsubToken: token?.pubsub_token ?? "",
    accountId: token?.account_id ?? "",
    onEvent: emitEvent,
    onReconnect: handleReconnect,
    enabled: !!token,
  });

  return (
    <MessagingStatusContext.Provider value={status}>
      <MessagingEventContext.Provider value={lastEvent}>
        <MessagingEmitContext.Provider value={emitEvent}>
          <MessagingReconnectContext.Provider value={reconnectedAt}>
            <InboxFilterContext.Provider value={inboxFilterValue}>
              {children}
            </InboxFilterContext.Provider>
          </MessagingReconnectContext.Provider>
        </MessagingEmitContext.Provider>
      </MessagingEventContext.Provider>
    </MessagingStatusContext.Provider>
  );
}

"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { useActionCable, type ConnectionStatus, type ActionCableEvent } from "@/hooks/use-action-cable";
import { getWsToken, syncUser } from "@/lib/api-client/messaging";

// Split into two contexts so components can subscribe to only what they need.
// Components that only care about events (conversation-list, message-view)
// won't re-render when connectionStatus changes, and vice versa.
const MessagingStatusContext = createContext<ConnectionStatus>("disconnected");
const MessagingEventContext = createContext<ActionCableEvent | null>(null);

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

const WS_URL = process.env.NEXT_PUBLIC_MESSAGING_WS_URL || "ws://localhost:3001/cable";

interface MessagingProviderProps {
  children: React.ReactNode;
}

export function MessagingProvider({ children }: MessagingProviderProps) {
  const [token, setToken] = useState<{
    pubsub_token: string;
    account_id: string;
    user_id: string;
  } | null>(null);
  const [lastEvent, setLastEvent] = useState<ActionCableEvent | null>(null);

  // Fetch WS token on mount — lazy sync if user not yet provisioned
  useEffect(() => {
    let cancelled = false;

    async function fetchToken() {
      try {
        const data = await getWsToken();
        if (!cancelled) setToken(data);
      } catch {
        // Token fetch failed — attempt lazy sync then retry once
        try {
          await syncUser();
          const data = await getWsToken();
          if (!cancelled) setToken(data);
        } catch (retryErr) {
          console.error("Error getting WS token after sync:", retryErr);
        }
      }
    }

    fetchToken();
    return () => { cancelled = true; };
  }, []);

  const handleEvent = useCallback((event: ActionCableEvent) => {
    console.log("[ws-provider] event:", event.event, "| data.id:", event.data?.id, "| data.conversation_id:", event.data?.conversation_id);
    setLastEvent(event);
  }, []);

  const { status } = useActionCable({
    url: WS_URL,
    pubsubToken: token?.pubsub_token ?? "",
    accountId: token?.account_id ?? "",
    onEvent: handleEvent,
    enabled: !!token,
  });

  return (
    <MessagingStatusContext.Provider value={status}>
      <MessagingEventContext.Provider value={lastEvent}>
        {children}
      </MessagingEventContext.Provider>
    </MessagingStatusContext.Provider>
  );
}

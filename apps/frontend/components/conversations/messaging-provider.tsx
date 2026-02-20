"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { useActionCable, type ConnectionStatus, type ActionCableEvent } from "@/hooks/use-action-cable";
import { getWsToken, syncUser } from "@/lib/api-client/messaging";

interface MessagingContextValue {
  connectionStatus: ConnectionStatus;
  lastEvent: ActionCableEvent | null;
}

const MessagingContext = createContext<MessagingContextValue>({
  connectionStatus: "disconnected",
  lastEvent: null,
});

export function useMessaging() {
  return useContext(MessagingContext);
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
    <MessagingContext.Provider value={{ connectionStatus: status, lastEvent }}>
      {children}
    </MessagingContext.Provider>
  );
}

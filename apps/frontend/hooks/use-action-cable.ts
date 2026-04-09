"use client";

import { useEffect, useRef, useCallback, useState } from "react";

export type ConnectionStatus = "connecting" | "connected" | "disconnected";

export interface ActionCableEvent {
  event: string;
  data: Record<string, unknown>;
}

interface UseActionCableOptions {
  url: string;
  pubsubToken: string;
  accountId: string;
  onEvent: (event: ActionCableEvent) => void;
  enabled?: boolean;
}

/**
 * Minimal ActionCable WebSocket client hook.
 *
 * Handles the Rails ActionCable protocol:
 * 1. Connect to ws://host/cable
 * 2. Receive { type: "welcome" }
 * 3. Subscribe: { command: "subscribe", identifier: JSON.stringify({ channel, pubsub_token, account_id }) }
 * 4. Receive { type: "confirm_subscription" }
 * 5. Receive messages: { identifier, message: { event, data } }
 * 6. Respond to { type: "ping" } (no response needed, just keep alive)
 */
export function useActionCable({
  url,
  pubsubToken,
  accountId,
  onEvent,
  enabled = true,
}: UseActionCableOptions) {
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttempts = useRef(0);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  const MAX_RECONNECT_DELAY = 30000;

  const identifier = JSON.stringify({
    channel: "RoomChannel",
    pubsub_token: pubsubToken,
    account_id: accountId,
  });

  const connect = useCallback(() => {
    if (!enabled || !url || !pubsubToken) return;

    try {
      setStatus("connecting");
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        reconnectAttempts.current = 0;
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          switch (data.type) {
            case "welcome":
              // Subscribe to RoomChannel after welcome
              ws.send(
                JSON.stringify({
                  command: "subscribe",
                  identifier,
                })
              );
              break;

            case "confirm_subscription":
              setStatus("connected");
              break;

            case "ping":
              // ActionCable pings don't require a response
              break;

            case "disconnect":
              ws.close();
              break;

            default:
              // Regular message
              if (data.message) {
                onEventRef.current(data.message as ActionCableEvent);
              }
              break;
          }
        } catch {
          // Ignore parse errors
        }
      };

      ws.onclose = () => {
        setStatus("disconnected");
        wsRef.current = null;

        // Reconnect with exponential backoff
        if (enabled) {
          const delay = Math.min(
            1000 * Math.pow(2, reconnectAttempts.current),
            MAX_RECONNECT_DELAY
          );
          reconnectAttempts.current += 1;
          reconnectTimer.current = setTimeout(connect, delay);
        }
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch {
      setStatus("disconnected");
    }
  }, [url, pubsubToken, accountId, identifier, enabled]);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect]);

  const disconnect = useCallback(() => {
    if (reconnectTimer.current) {
      clearTimeout(reconnectTimer.current);
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  return { status, disconnect };
}

"use client";

import { useEffect, useState } from "react";
import { getConversationOrders } from "@/lib/api-client/orders";
import type { Order } from "@/lib/services/order-service";

interface UseConversationOrdersResult {
  orders: Order[];
  loading: boolean;
  error: boolean;
}

/**
 * Carga las órdenes vinculadas a una conversación (orders.messaging_conversation_id).
 * Se re-ejecuta al cambiar conversationId e ignora respuestas obsoletas.
 */
export function useConversationOrders(
  conversationId: number | undefined
): UseConversationOrdersResult {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (conversationId == null) {
        setOrders([]);
        setLoading(false);
        setError(false);
        return;
      }

      setLoading(true);
      setError(false);
      try {
        const res = await getConversationOrders(conversationId);
        if (!cancelled) setOrders(res.items);
      } catch {
        if (!cancelled) {
          setError(true);
          setOrders([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [conversationId]);

  return { orders, loading, error };
}

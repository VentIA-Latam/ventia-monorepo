"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { useConversationOrders } from "@/hooks/use-conversation-orders";
import type { Order } from "@/lib/services/order-service";
import { cn, formatCurrency } from "@/lib/utils";

interface ConversationOrdersSectionProps {
  conversationId: number;
}

/** Estilo de badge por estado de pago, alineado con la tabla de órdenes. */
function paymentBadgeClass(status: string): string {
  switch (status) {
    case "Pagado":
      return "bg-success-bg text-success border-success/30";
    case "Pendiente":
      return "bg-warning-bg text-warning border-warning/30";
    case "Rechazado":
    case "Cancelado":
      return "bg-destructive/10 text-destructive border-destructive/30";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

/** Número de pedido legible: tail del gid de Shopify, id de Woo, o id interno. */
function orderNumber(order: Order): string {
  if (order.shopify_order_id) {
    const tail = order.shopify_order_id.split("/").pop();
    return `#${tail || order.id}`;
  }
  if (order.woocommerce_order_id != null) {
    return `#${order.woocommerce_order_id}`;
  }
  return `#${order.id}`;
}

function OrderMiniCard({ order }: { order: Order }) {
  return (
    <div className="rounded-lg border bg-card px-3 py-2 space-y-1">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium truncate">{orderNumber(order)}</span>
        <span
          className={cn(
            "inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] font-medium shrink-0",
            paymentBadgeClass(order.status)
          )}
        >
          {order.status}
        </span>
      </div>
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">
          {formatCurrency(order.total_price, order.currency)}
        </span>
        {order.created_at && (
          <span>
            {new Date(order.created_at).toLocaleDateString("es-PE", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })}
          </span>
        )}
      </div>
    </div>
  );
}

export function ConversationOrdersSection({ conversationId }: ConversationOrdersSectionProps) {
  const { orders, loading, error } = useConversationOrders(conversationId);

  return (
    <div className="space-y-3">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        Pedidos{!loading && !error && orders.length > 0 ? ` (${orders.length})` : ""}
      </p>

      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-14 w-full rounded-lg" />
          <Skeleton className="h-14 w-full rounded-lg" />
        </div>
      ) : error ? (
        <p className="text-xs text-muted-foreground">No se pudieron cargar los pedidos</p>
      ) : orders.length === 0 ? (
        <p className="text-xs text-muted-foreground">Sin pedidos vinculados</p>
      ) : (
        <div className="space-y-2">
          {orders.map((order) => (
            <OrderMiniCard key={order.id} order={order} />
          ))}
        </div>
      )}
    </div>
  );
}

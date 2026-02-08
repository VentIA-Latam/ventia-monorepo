"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Order } from "@/lib/services/order-service";
import type { Invoice } from "@/lib/types/invoice";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OrderHeader } from "./order-header";
import { OrderCustomerCard } from "./order-customer-card";
import { OrderProductsTable } from "./order-products-table";
import { OrderFinancialSummary } from "./order-financial-summary";
import { OrderInvoicesList } from "./order-invoices-list";

interface OrderDetailProps {
  order: Order;
  invoices: Invoice[];
  basePath?: string;
}

/**
 * Client Component - UI de detalle de orden
 *
 * Componente interactivo que:
 * - Muestra toda la información de la orden
 * - Muestra los comprobantes emitidos
 * - Permite validar el pago
 * - Permite generar facturas/boletas
 * - Navega de vuelta a la lista
 */
export function OrderDetail({ order, invoices, basePath = '/dashboard' }: OrderDetailProps) {
  const router = useRouter();
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Manejar validación de pago
  const handleValidatePago = async () => {
    try {
      setIsValidating(true);
      setError(null);

      const response = await fetch(`/api/orders/${order.id}/validate`, {
        method: 'POST',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Error al validar el pago' }));
        throw new Error(errorData.error || 'Error al validar el pago');
      }

      router.refresh();
    } catch (err) {
      console.error('Error validating order:', err);
      setError(err instanceof Error ? err.message : 'Error al validar el pago');
    } finally {
      setIsValidating(false);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <OrderHeader
        order={order}
        isValidating={isValidating}
        error={error}
        onValidatePago={handleValidatePago}
        basePath={basePath}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Left Column - Main Info */}
        <div className="lg:col-span-2 space-y-4 sm:space-y-6">
          <OrderCustomerCard order={order} />
          <OrderProductsTable order={order} />
        </div>

        {/* Right Column - Summary */}
        <div className="space-y-4 sm:space-y-6">
          <OrderFinancialSummary
            order={order}
            isValidating={isValidating}
            onValidatePago={handleValidatePago}
            basePath={basePath}
          />

          {/* Notas */}
          {order.notes && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base sm:text-lg">Notas</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs sm:text-sm text-muted-foreground">{order.notes}</p>
              </CardContent>
            </Card>
          )}

          <OrderInvoicesList order={order} invoices={invoices} basePath={basePath} />
        </div>
      </div>
    </div>
  );
}

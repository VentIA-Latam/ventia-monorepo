"use client";

import { useRouter } from "next/navigation";
import type { Order } from "@/lib/services/order-service";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, FileText } from "lucide-react";

interface OrderFinancialSummaryProps {
  order: Order;
  isValidating: boolean;
  onValidatePago: () => void;
}

export function OrderFinancialSummary({
  order,
  isValidating,
  onValidatePago,
}: OrderFinancialSummaryProps) {
  const router = useRouter();

  const formatCurrency = (amount: number, currency: string) => {
    const symbols: Record<string, string> = {
      'USD': '$',
      'EUR': '€',
      'GBP': '£',
      'PEN': 'S/',
      'MXN': '$',
      'ARS': '$',
      'CLP': '$',
    };
    return `${symbols[currency] || currency} ${amount.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <>
      {/* Acciones Requeridas */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base sm:text-lg">Acciones Requeridas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 sm:space-y-3">
          {!order.validado && (
            <Button
              className="w-full gap-2 text-xs sm:text-sm"
              size="sm"
              onClick={onValidatePago}
              disabled={isValidating || order.status === 'Cancelado'}
            >
              <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4" />
              {isValidating ? 'Validando...' : 'Validar Pago'}
            </Button>
          )}
          <Button
            variant={order.validado ? "default" : "outline"}
            className="w-full gap-2 text-xs sm:text-sm"
            size="sm"
            disabled={!order.validado || order.status === 'Cancelado'}
            onClick={() => router.push(`/dashboard/invoices/new?orderId=${order.id}`)}
          >
            <FileText className="w-3 h-3 sm:w-4 sm:h-4" />
            Crear Comprobante
          </Button>
        </CardContent>
      </Card>

      {/* Resumen Financiero */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base sm:text-lg">Resumen Financiero</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span>{formatCurrency(order.total_price / 1.18, order.currency)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">IGV (18%)</span>
            <span>{formatCurrency(order.total_price - (order.total_price / 1.18), order.currency)}</span>
          </div>
          <div className="border-t pt-3 flex justify-between items-center">
            <span className="font-semibold text-sm sm:text-base">Total</span>
            <span className="text-lg sm:text-xl font-bold text-primary">
              {formatCurrency(order.total_price, order.currency)}
            </span>
          </div>
        </CardContent>
      </Card>
    </>
  );
}

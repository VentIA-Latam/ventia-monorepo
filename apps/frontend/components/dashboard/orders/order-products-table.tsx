"use client";

import type { Order } from "@/lib/services/order-service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package } from "lucide-react";

interface OrderProductsTableProps {
  order: Order;
}

export function OrderProductsTable({ order }: OrderProductsTableProps) {
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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
          <Package className="w-4 h-4 sm:w-5 sm:h-5" />
          Productos
          <span className="text-xs sm:text-sm font-normal text-muted-foreground ml-2">
            {order.line_items?.length || 0} ítems
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[500px]">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-2 sm:p-3 text-xs sm:text-sm font-semibold">Producto</th>
                  <th className="text-center p-2 sm:p-3 text-xs sm:text-sm font-semibold">Precio Unitario</th>
                  <th className="text-center p-2 sm:p-3 text-xs sm:text-sm font-semibold">Cant.</th>
                  <th className="text-right p-2 sm:p-3 text-xs sm:text-sm font-semibold">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {order.line_items && order.line_items.length > 0 ? (
                  order.line_items.map((item, index) => {
                    const unitPrice = item.unitPrice || 0;
                    const quantity = item.quantity || 1;
                    const subtotal = item.subtotal || 0;

                    return (
                      <tr key={item.id || index} className="border-t">
                        <td className="p-2 sm:p-3">
                          <div className="flex items-center gap-2 sm:gap-3">
                            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-muted rounded flex items-center justify-center shrink-0">
                              <Package className="w-5 h-5 sm:w-6 sm:h-6 text-muted-foreground" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-xs sm:text-sm truncate">{item.product || 'Producto sin nombre'}</p>
                              <p className="text-xs text-muted-foreground truncate">
                                SKU: {item.sku || 'N/A'}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="p-2 sm:p-3 text-center text-xs sm:text-sm">
                          {formatCurrency(unitPrice, order.currency)}
                        </td>
                        <td className="p-2 sm:p-3 text-center text-xs sm:text-sm">{quantity}</td>
                        <td className="p-2 sm:p-3 text-right font-semibold text-xs sm:text-sm">
                          {formatCurrency(subtotal, order.currency)}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={4} className="p-4 sm:p-6 text-center text-muted-foreground text-xs sm:text-sm">
                      No hay productos en este pedido
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

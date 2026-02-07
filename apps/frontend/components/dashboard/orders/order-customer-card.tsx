"use client";

import type { Order } from "@/lib/services/order-service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { User, Mail } from "lucide-react";

interface OrderCustomerCardProps {
  order: Order;
}

export function OrderCustomerCard({ order }: OrderCustomerCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
          <User className="w-4 h-4 sm:w-5 sm:h-5" />
          Información del Cliente
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <p className="text-xs sm:text-sm font-medium text-muted-foreground">CLIENTE</p>
            <p className="text-sm sm:text-base font-semibold break-words">{order.customer_name || 'Sin nombre'}</p>
          </div>
          <div>
            <p className="text-xs sm:text-sm font-medium text-muted-foreground">CONTACTO</p>
            <div className="flex items-center gap-2 text-xs sm:text-sm">
              <Mail className="w-3 h-3 sm:w-4 sm:h-4 text-muted-foreground shrink-0" />
              <span className="text-sky-700 underline break-all">{order.customer_email}</span>
            </div>
          </div>
        </div>

        {/* Dirección de envío */}
        <div>
          <p className="text-xs sm:text-sm font-medium text-muted-foreground mb-2">DIRECCIÓN DE ENVÍO</p>
          {order.shipping_address ? (
            <p className="text-xs sm:text-sm">{order.shipping_address}</p>
          ) : (
            <p className="text-xs sm:text-sm text-muted-foreground">Información no disponible</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

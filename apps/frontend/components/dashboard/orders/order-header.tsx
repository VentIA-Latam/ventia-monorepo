"use client";

import { useRouter } from "next/navigation";
import type { Order } from "@/lib/services/order-service";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  CheckCircle,
  Ban,
  FileText,
} from "lucide-react";
import { CancelOrderDialog } from "./cancel-order-dialog";
import { formatDateTime, getEcommerceOrderId } from "@/lib/utils";

interface OrderHeaderProps {
  order: Order;
  isValidating: boolean;
  error: string | null;
  onValidatePago: () => void;
  basePath?: string;
}

export function OrderHeader({
  order,
  isValidating,
  error,
  onValidatePago,
  basePath = '/dashboard',
}: OrderHeaderProps) {
  const router = useRouter();

  const getStatusBadge = () => {
    if (order.validado && order.status === 'Pagado') {
      return (
        <Badge className="
          bg-success-bg
          text-success
          border-success/30
          hover:bg-success-bg
          hover:text-success
          hover:border-success/30
          transition-colors
          cursor-default
        ">
          <CheckCircle className="w-3 h-3 mr-1" />
          Pago Validado
        </Badge>
      );
    } else if (order.status === 'Cancelado') {
      return (
        <Badge className="
          bg-danger-bg
          text-danger
          border-danger/30
          hover:bg-danger-bg
          hover:text-danger
          hover:border-danger/30
          transition-colors
          cursor-default
        ">
          Cancelado
        </Badge>
      );
    }
    return (
      <Badge className="
        bg-warning-bg
        text-warning
        border-warning/30
        hover:bg-warning-bg
        hover:text-warning
        hover:border-warning/30
        transition-colors
        cursor-default
      ">
        Pendiente de Pago
      </Badge>
    );
  };

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-start gap-2 sm:gap-4">
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 mt-1 sm:mt-0"
            onClick={() => router.push(`${basePath}/orders`)}
          >
            <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold break-words">Pedido #{getEcommerceOrderId(order)}</h1>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Creado el {formatDateTime(order.created_at)}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {getStatusBadge()}
          {!order.validado && (
            <Button
              className="gap-2 text-xs sm:text-sm"
              size="sm"
              onClick={onValidatePago}
              disabled={isValidating || order.status === 'Cancelado'}
            >
              <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4" />
              {isValidating ? 'Validando...' : 'Validar Pago'}
            </Button>
          )}
          {order.validado && (
            <Button
              className="gap-2 text-xs sm:text-sm"
              size="sm"
              disabled={order.status === 'Cancelado'}
              onClick={() => router.push(`${basePath}/invoices/new?orderId=${order.id}`)}
            >
              <FileText className="w-3 h-3 sm:w-4 sm:h-4" />
              Crear Comprobante
            </Button>
          )}
          <CancelOrderDialog
            order={order}
            onCancelled={() => router.refresh()}
            trigger={
              <Button variant="destructive" className="gap-2 text-xs sm:text-sm" size="sm" disabled={order.status === 'Cancelado'}>
                <Ban className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">Cancelar Pedido</span>
              </Button>
            }
          />
        </div>
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive px-3 sm:px-4 py-2 sm:py-3 rounded-lg">
          <p className="font-semibold text-sm">Error</p>
          <p className="text-xs sm:text-sm">{error}</p>
        </div>
      )}
    </>
  );
}

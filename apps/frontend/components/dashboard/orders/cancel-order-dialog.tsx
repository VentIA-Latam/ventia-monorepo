"use client";

import { useState } from "react";
import { Order } from "@/lib/services/order-service";
import { cancelOrder } from "@/lib/api-client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";

interface CancelOrderDialogProps {
  order: Order;
  trigger: React.ReactNode;
  onCancelled: () => void;
}

const CANCEL_REASONS = [
  { value: "CUSTOMER", label: "El cliente cambió o canceló el pedido" },
  { value: "DECLINED", label: "Pago rechazado" },
  { value: "FRAUD", label: "Pedido fraudulento" },
  { value: "INVENTORY", label: "Artículos no disponibles" },
  { value: "STAFF", label: "Error del personal" },
  { value: "OTHER", label: "Otro" },
];

const REFUND_METHODS = [
  { value: "original", label: "Método de pago original" },
  { value: "store_credit", label: "Crédito en tienda" },
  { value: "later", label: "Reembolso posterior" },
];

export function CancelOrderDialog({
  order,
  trigger,
  onCancelled,
}: CancelOrderDialogProps) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [refundMethod, setRefundMethod] = useState("original");
  const [restock, setRestock] = useState(true);
  const [notifyCustomer, setNotifyCustomer] = useState(true);
  const [staffNote, setStaffNote] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isDraftOrder = !order.validado;
  const isCompletedShopify = order.validado && order.shopify_order_id !== null;

  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      setReason("");
      setRefundMethod("original");
      setRestock(true);
      setNotifyCustomer(true);
      setStaffNote("");
      setError(null);
    }
    setOpen(newOpen);
  };

  const handleSubmit = async () => {
    // Para draft orders, usamos "OTHER" como motivo por defecto (requerido por backend pero no usado)
    const submitReason = isDraftOrder ? "OTHER" : reason;
    if (!submitReason) return;

    setIsLoading(true);
    setError(null);

    try {
      await cancelOrder(order.id, {
        reason: submitReason,
        ...(isCompletedShopify && {
          restock,
          notify_customer: notifyCustomer,
          refund_method: refundMethod,
        }),
        staff_note: staffNote || null,
      });

      setOpen(false);
      onCancelled();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : isDraftOrder ? "Error al eliminar el pedido" : "Error al cancelar el pedido"
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Modal simplificado para draft orders
  if (isDraftOrder) {
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogTrigger asChild>{trigger}</DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>¿Eliminar pedido preliminar #{order.id}?</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              ¿Seguro que quieres eliminar el pedido preliminar <span className="font-semibold">#{order.id}</span>?
              Esta acción no se puede deshacer.
            </p>
            {/* Error */}
            {error && (
              <div className="bg-destructive/10 text-destructive px-3 py-2 rounded-lg">
                <p className="text-xs sm:text-sm">{error}</p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isLoading}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleSubmit}
              disabled={isLoading}
            >
              {isLoading ? "Eliminando..." : "Eliminar pedido"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // Modal completo para órdenes validadas
  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cancelar pedido #{order.id}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Motivo de cancelación */}
          <div className="space-y-1.5">
            <Label htmlFor="cancel-reason">
              Motivo de cancelación{" "}
              <span className="text-destructive">*</span>
            </Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger id="cancel-reason">
                <SelectValue placeholder="Selecciona un motivo" />
              </SelectTrigger>
              <SelectContent>
                {CANCEL_REASONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Campos exclusivos de Shopify completado */}
          {isCompletedShopify && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="refund-method">Método de reembolso</Label>
                <Select
                  value={refundMethod}
                  onValueChange={setRefundMethod}
                >
                  <SelectTrigger id="refund-method">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REFUND_METHODS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="restock"
                  checked={restock}
                  onCheckedChange={(checked) => setRestock(checked === true)}
                />
                <Label htmlFor="restock" className="font-normal">
                  Reponer inventario
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="notify-customer"
                  checked={notifyCustomer}
                  onCheckedChange={(checked) =>
                    setNotifyCustomer(checked === true)
                  }
                />
                <Label htmlFor="notify-customer" className="font-normal">
                  Notificar al cliente
                </Label>
              </div>
            </>
          )}

          {/* Nota interna */}
          <div className="space-y-1.5">
            <Label htmlFor="staff-note">Nota interna (opcional)</Label>
            <Textarea
              id="staff-note"
              placeholder="Nota para el equipo..."
              value={staffNote}
              onChange={(e) => setStaffNote(e.target.value)}
              className="resize-none"
              rows={3}
            />
          </div>

          {/* Error */}
          {error && (
            <div className="bg-destructive/10 text-destructive px-3 py-2 rounded-lg">
              <p className="text-xs sm:text-sm">{error}</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isLoading}
          >
            Mantener pedido
          </Button>
          <Button
            variant="destructive"
            onClick={handleSubmit}
            disabled={isLoading || !reason}
          >
            {isLoading ? "Cancelando..." : "Cancelar pedido"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

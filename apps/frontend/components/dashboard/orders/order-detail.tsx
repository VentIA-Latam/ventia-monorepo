"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Order, validateOrder } from "@/lib/services/order-service";
import type { Invoice } from "@/lib/types/invoice";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  CheckCircle,
  Ban,
  User,
  Mail,
  MapPin,
  Package,
  FileText
} from "lucide-react";
import { CancelOrderDialog } from "./cancel-order-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime, getEcommerceOrderId } from "@/lib/utils";

interface OrderDetailProps {
  order: Order;
  invoices: Invoice[];
}

/**
 * 🎨 Client Component - UI de detalle de orden
 * 
 * Componente interactivo que:
 * - Muestra toda la información de la orden
 * - Muestra los comprobantes emitidos
 * - Permite validar el pago
 * - Permite generar facturas/boletas
 * - Navega de vuelta a la lista
 */
export function OrderDetail({ order, invoices }: OrderDetailProps) {
  const router = useRouter();
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Formatear moneda
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

  // Manejar validación de pago
  const handleValidatePago = async () => {
    try {
      setIsValidating(true);
      setError(null);

      // Llamar al endpoint de validación que maneja el token en el servidor
      const response = await fetch(`/api/orders/${order.id}/validate`, {
        method: 'POST',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Error al validar el pago' }));
        throw new Error(errorData.error || 'Error al validar el pago');
      }

      // Refrescar la página para mostrar datos actualizados
      router.refresh();

    } catch (err) {
      console.error('Error validating order:', err);
      setError(err instanceof Error ? err.message : 'Error al validar el pago');
    } finally {
      setIsValidating(false);
    }
  };

  // Badge de estado
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
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-start gap-2 sm:gap-4">
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 mt-1 sm:mt-0"
            onClick={() => router.push('/dashboard/orders')}
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
              onClick={handleValidatePago}
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
              onClick={() => router.push(`/dashboard/invoices/new?orderId=${order.id}`)}
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

      {/* Error message */}
      {error && (
        <div className="bg-destructive/10 text-destructive px-3 sm:px-4 py-2 sm:py-3 rounded-lg">
          <p className="font-semibold text-sm">Error</p>
          <p className="text-xs sm:text-sm">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Left Column - Main Info */}
        <div className="lg:col-span-2 space-y-4 sm:space-y-6">
          {/* Información del Cliente */}
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

          {/* Productos */}
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

          {/* Evidencia de Pago */}
          {/*           <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5" />
                  Evidencia de Pago
                </span>
                <Button variant="link" size="sm" className="text-sky-600">
                  Ver Historial
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {order.payment_method ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-16 h-16 bg-muted rounded flex items-center justify-center">
                        <CreditCard className="w-8 h-8 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">Método de Pago</p>
                        <p className="text-lg font-semibold">{order.payment_method}</p>
                      </div>
                    </div>
                    <Button variant="link" size="sm" className="text-sky-600">
                      Descargar Archivo
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">MÉTODO</p>
                      <p className="font-medium">{order.payment_method}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">REFERENCIA</p>
                      <p className="font-medium">REF-{order.id}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6 text-muted-foreground">
                  <p>No se ha cargado evidencia de pago</p>
                  <p className="text-xs mt-1">(Pendiente de carga por el cliente)</p>
                </div>
              )}
            </CardContent>
          </Card> */}
        </div>

        {/* Right Column - Summary */}
        <div className="space-y-4 sm:space-y-6">
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
                  onClick={handleValidatePago}
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
              {/* <Button variant="outline" className="w-full gap-2 text-xs sm:text-sm" size="sm" disabled>
                <MapPin className="w-3 h-3 sm:w-4 sm:h-4" />
                Actualizar Logística
              </Button> */}
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

          {/* Información de Entrega */}
          {/* <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <Calendar className="w-4 h-4 sm:w-5 sm:h-5" />
                Información de Entrega
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-xs sm:text-sm font-medium text-muted-foreground mb-1">
                  FECHA DE ENTREGA DEL PEDIDO
                </p>
                <p className="text-xs sm:text-sm">
                  Información no disponible
                </p>
              </div>
              <div>
                <p className="text-xs sm:text-sm font-medium text-muted-foreground mb-1 flex items-center gap-2">
                  <Clock className="w-3 h-3 sm:w-4 sm:h-4" />
                  HORARIO DE DESPACHO
                </p>
                <p className="text-xs sm:text-sm">
                  Información no disponible
                </p>
              </div>
            </CardContent>
          </Card> */}

          {/* Información Adicional */}
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

          {/* Comprobantes Emitidos - US-006 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <FileText className="w-4 h-4 sm:w-5 sm:h-5" />
                Comprobantes Emitidos
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {invoices.length === 0 ? (
                <div className="text-center py-6 space-y-3">
                  <p className="text-sm text-muted-foreground">
                    No se han emitido comprobantes para esta orden
                  </p>
                  {order.validado && (
                    <Button
                      onClick={() => router.push(`/dashboard/invoices/new?orderId=${order.id}`)}
                      className="gap-2"
                    >
                      <FileText className="h-4 w-4" />
                      Emitir Comprobante
                    </Button>
                  )}
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    {invoices.map((invoice) => (
                      <div
                        key={invoice.id}
                        className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-sm">
                              {invoice.serie}-{String(invoice.correlativo).padStart(8, "0")}
                            </p>
                            <Badge
                              variant={
                                invoice.efact_status === "success" ? "default" :
                                  invoice.efact_status === "processing" ? "secondary" : "destructive"
                              }
                              className="text-xs"
                            >
                              {invoice.efact_status}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span>
                              {invoice.invoice_type === "01" ? "Factura" :
                                invoice.invoice_type === "03" ? "Boleta" :
                                  invoice.invoice_type === "07" ? "Nota de Crédito" : "Nota de Débito"}
                            </span>
                            <span>•</span>
                            <span>S/ {invoice.total.toFixed(2)}</span>
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => router.push(`/dashboard/invoices/${invoice.id}`)}
                        >
                          Ver Detalle
                        </Button>
                      </div>
                    ))}
                  </div>
                  {order.validado && (
                    <Button
                      onClick={() => router.push(`/dashboard/invoices/new?orderId=${order.id}`)}
                      variant="outline"
                      className="w-full gap-2"
                    >
                      <FileText className="h-4 w-4" />
                      Emitir Nuevo Comprobante
                    </Button>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Order, validateOrder } from "@/lib/services/order-service";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  CheckCircle,
  Printer,
  X,
  User,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Clock,
  CreditCard,
  Package
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface OrderDetailProps {
  order: Order;
}

/**
 * 🎨 Client Component - UI de detalle de orden
 * 
 * Componente interactivo que:
 * - Muestra toda la información de la orden
 * - Permite validar el pago
 * - Navega de vuelta a la lista
 */
export function OrderDetail({ order }: OrderDetailProps) {
  const router = useRouter();
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Formatear fecha
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

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
    if (order.validado) {
      return (
        <Badge className="bg-green-50 text-green-700 border-green-200">
          <CheckCircle className="w-3 h-3 mr-1" />
          Pago Validado
        </Badge>
      );
    }
    return (
      <Badge className="bg-orange-50 text-orange-700 border-orange-200">
        Pendiente de Pago
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/dashboard/orders')}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Pedido #{order.shopify_draft_order_id || order.id}</h1>
            <p className="text-sm text-muted-foreground">
              Creado el {formatDate(order.created_at)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {getStatusBadge()}
          <Button variant="outline" className="gap-2" disabled>
            <Printer className="w-4 h-4" />
            Imprimir
          </Button>
          {!order.validado && (
            <Button
              className="gap-2"
              onClick={handleValidatePago}
              disabled={isValidating}
            >
              <CheckCircle className="w-4 h-4" />
              {isValidating ? 'Validando...' : 'Validar Pago'}
            </Button>
          )}
          <Button variant="destructive" className="gap-2" onClick={() => router.push('/dashboard/orders')}>
            <X className="w-4 h-4" />
            Cancelar
          </Button>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-lg">
          <p className="font-semibold">Error</p>
          <p className="text-sm">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Información del Cliente */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5" />
                Información del Cliente
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">CLIENTE</p>
                  <p className="text-base font-semibold">{order.customer_name || 'Sin nombre'}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">CONTACTO</p>
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sky-700 underline">{order.customer_email}</span>
                  </div>
                </div>
              </div>

              {/* Dirección de envío - Placeholder para futuros campos */}
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">DIRECCIÓN DE ENVÍO</p>
                <div className="text-sm text-muted-foreground">
                  <p>Información no disponible</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Productos */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="w-5 h-5" />
                Productos
                <span className="text-sm font-normal text-muted-foreground ml-2">
                  {order.line_items?.length || 0} ítems
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left p-3 text-sm font-semibold">Producto</th>
                      <th className="text-center p-3 text-sm font-semibold">Precio Unitario</th>
                      <th className="text-center p-3 text-sm font-semibold">Cant.</th>
                      <th className="text-right p-3 text-sm font-semibold">Subtotal</th>
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
                            <td className="p-3">
                              <div className="flex items-center gap-3">
                                <div className="w-12 h-12 bg-muted rounded flex items-center justify-center">
                                  <Package className="w-6 h-6 text-muted-foreground" />
                                </div>
                                <div>
                                  <p className="font-medium">{item.product || 'Producto sin nombre'}</p>
                                  <p className="text-xs text-muted-foreground">
                                    SKU: {item.sku || 'N/A'}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="p-3 text-center">
                              {formatCurrency(unitPrice, order.currency)}
                            </td>
                            <td className="p-3 text-center">{quantity}</td>
                            <td className="p-3 text-right font-semibold">
                              {formatCurrency(subtotal, order.currency)}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={4} className="p-6 text-center text-muted-foreground">
                          No hay productos en este pedido
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
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
        <div className="space-y-6">
          {/* Acciones Requeridas */}
          <Card>
            <CardHeader>
              <CardTitle>Acciones Requeridas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {!order.validado && (
                <Button
                  className="w-full gap-2"
                  onClick={handleValidatePago}
                  disabled={isValidating}
                >
                  <CheckCircle className="w-4 h-4" />
                  {isValidating ? 'Validando...' : 'Validar Pago'}
                </Button>
              )}
              <Button variant="outline" className="w-full gap-2" disabled>
                <Package className="w-4 h-4" />
                Generar Factura
              </Button>
              <Button variant="outline" className="w-full gap-2" disabled>
                <MapPin className="w-4 h-4" />
                Actualizar Logística
              </Button>
            </CardContent>
          </Card>

          {/* Resumen Financiero */}
          <Card>
            <CardHeader>
              <CardTitle>Resumen Financiero</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/*               <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatCurrency(order.total_price * 0.84, order.currency)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">IVA (16%)</span>
                <span>{formatCurrency(order.total_price * 0.16, order.currency)}</span>
              </div>
              <div className="flex justify-between text-sm text-green-600">
                <span>Descuento (Promo)</span>
                <span>-{formatCurrency(0, order.currency)}</span>
              </div> */}
              <div className="border-t pt-3 flex justify-between">
                <span className="font-semibold">Total</span>
                <span className="text-xl font-bold text-primary">
                  {formatCurrency(order.total_price, order.currency)}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Información de Entrega */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Información de Entrega
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Campos futuros de la API */}
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">
                  FECHA DE ENTREGA DEL PEDIDO
                </p>
                <p className="text-sm">
                  {/* Placeholder para fecha_entrega_pedido */}
                  Información no disponible
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1 flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  HORARIO DE DESPACHO
                </p>
                <p className="text-sm">
                  {/* Placeholder para horario_despacho */}
                  Información no disponible
                </p>
              </div>
              {/*               <div className="pt-3 border-t">
                <p className="text-xs text-muted-foreground">
                  Canal de Venta
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span>🏢</span>
                  <span className="text-sm font-medium">
                    {order.status === 'Pagado' ? 'WhatsApp Directo' : 'Portal B2B'}
                  </span>
                </div>
              </div> */}
            </CardContent>
          </Card>

          {/* Información Adicional */}
          {order.notes && (
            <Card>
              <CardHeader>
                <CardTitle>Notas</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{order.notes}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

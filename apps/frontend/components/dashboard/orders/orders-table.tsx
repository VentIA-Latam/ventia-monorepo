"use client";

import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Order } from "@/lib/services/order-service";
import { getEcommerceOrderId, extractShopifyOrderId, formatDateTime, getCurrencySymbol, cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { FileText, MoreVertical, Eye, Ban } from "lucide-react";
import { CancelOrderDialog } from "./cancel-order-dialog";

interface OrdersTableProps {
  orders: Order[];
}


const getAvatarColor = (name: string) => {
  const colors = [
    'bg-volt/10 text-volt',
    'bg-aqua/15 text-marino',
    'bg-luma/20 text-marino',
    'bg-cielo text-volt',
    'bg-marino/10 text-marino',
    'bg-aqua/10 text-noche',
  ];
  const index = name.charCodeAt(0) % colors.length;
  return colors[index];
};

const getEstadoColor = (estado: string) => {
  switch (estado) {
    case "Pagado":
      return "bg-success-bg text-success border-success/30"
    case "Pendiente":
      return "bg-warning-bg text-warning border-warning/30"
    default:
      return "bg-muted text-muted-foreground border-border"
  }
}

export function OrdersTable({ orders }: OrdersTableProps) {
  const router = useRouter();

  const handleOrderClick = (orderId: number) => {
    router.push(`/dashboard/orders/${orderId}`);
  };

  return (
    <div className="border rounded-lg bg-card shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 border-b border-border">
              <TableHead className="min-w-[120px]">
                ID DRAFT
              </TableHead>
              <TableHead className="min-w-[120px]">
                ID ORDEN
              </TableHead>
              <TableHead className="min-w-[200px]">
                CLIENTE
              </TableHead>
              <TableHead className="min-w-[120px]">
                ESTADO PAGO
              </TableHead>
              <TableHead className="text-right min-w-[100px]">
                MONTO
              </TableHead>
              <TableHead className="text-center min-w-[120px]">
                ACCIONES
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((order) => (
              <TableRow
                key={order.id}
                className="hover:bg-cielo/20 cursor-pointer transition-all duration-200 border-b border-border last:border-0 border-l-2 border-l-transparent hover:border-l-volt"
                onClick={() => handleOrderClick(order.id)}
              >
                <TableCell className="min-w-[120px]">
                  <div>
                    <div className="font-semibold text-volt hover:underline cursor-pointer text-sm">
                      {getEcommerceOrderId({
                        shopify_draft_order_id: order.shopify_draft_order_id,
                        woocommerce_order_id: order.woocommerce_order_id
                      })}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {formatDateTime(order.created_at)}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="min-w-[120px]">
                  {order.shopify_order_id ? (
                    <div>
                      <div className="font-semibold text-success text-sm">
                        {extractShopifyOrderId(order.shopify_order_id)}
                      </div>
                      {order.validated_at && (
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {formatDateTime(order.validated_at)}
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground italic">Pendiente</span>
                  )}
                </TableCell>
                <TableCell className="min-w-[200px]">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-semibold text-xs sm:text-sm ${getAvatarColor(order.customer_name || 'Sin nombre')}`}>
                      {(order.customer_name || 'SN').substring(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-sm text-foreground truncate">
                        {order.customer_name || 'Sin nombre'}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5 truncate">
                        {order.customer_email}
                      </div>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-xs px-3 py-0.5",
                      getEstadoColor(order.status)
                    )}
                  >
                    {order.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right font-semibold text-sm text-foreground font-mono tabular-nums min-w-[100px]">
                  {getCurrencySymbol(order.currency)}{order.total_price.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </TableCell>
                <TableCell className="text-center min-w-[80px]">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <Link href={`/dashboard/orders/${order.id}`}>
                        <DropdownMenuItem>
                          <Eye className="h-4 w-4 mr-2" />
                          Ver detalles
                        </DropdownMenuItem>
                      </Link>
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/dashboard/invoices/new?orderId=${order.id}`);
                        }}
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        Ir a Facturación
                      </DropdownMenuItem>
                      {order.status !== 'Cancelado' && (
                        <>
                          <DropdownMenuSeparator />
                          <CancelOrderDialog
                            order={order}
                            onCancelled={() => router.refresh()}
                            trigger={
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onSelect={(e) => e.preventDefault()}
                              >
                                <Ban className="h-4 w-4 mr-2" />
                                Cancelar Pedido
                              </DropdownMenuItem>
                            }
                          />
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

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
import { INVOICE_STATUS_COLORS } from "@/lib/types/invoice";
import { getEcommerceOrderId, extractShopifyOrderId, formatDateTime, getCurrencySymbol, cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { FileText, MoreVertical, Eye, Ban, Bot, CheckCircle2, AlertCircle, Clock } from "lucide-react";
import Image from "next/image";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { CancelOrderDialog } from "./cancel-order-dialog";

interface OrdersTableProps {
  orders: Order[];
  basePath?: string;
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

function ChannelBadge({ channel }: { channel: string | null }) {
  switch (channel) {
    case "venta_whatsapp":
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-success/10 ring-1 ring-inset ring-success/20 cursor-default">
              <Bot className="h-6 w-6 text-success" />
            </div>
          </TooltipTrigger>
          <TooltipContent side="top">WhatsApp AI Agent</TooltipContent>
        </Tooltip>
      );
    case "shopify":
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-muted/50 cursor-default">
              <Image src="/external-icons/shopify-icon.png" alt="Shopify" width={35} height={35} />
            </div>
          </TooltipTrigger>
          <TooltipContent side="top">Shopify</TooltipContent>
        </Tooltip>
      );
    case "woocommerce":
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-muted/50 cursor-default">
              <Image src="/external-icons/woo-icon.png" alt="WooCommerce" width={35} height={35} />
            </div>
          </TooltipTrigger>
          <TooltipContent side="top">WooCommerce</TooltipContent>
        </Tooltip>
      );
    default:
      return (
        <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-dashed border-muted-foreground/20 cursor-default">
          <span className="text-[10px] font-medium text-muted-foreground/35 uppercase tracking-wide">N/A</span>
        </div>
      );
  }
}

function InvoiceBadge({ invoices }: { invoices: Order["invoices"] }) {
  if (!invoices || invoices.length === 0) {
    return (
      <Badge
        variant="outline"
        className="text-xs px-2.5 py-0.5 gap-1 cursor-default border-dashed border-muted-foreground/25 text-muted-foreground/50 bg-transparent"
      >
        <FileText className="h-3 w-3" />
        Sin emitir
      </Badge>
    );
  }

  const hasSuccess = invoices.some((inv) => inv.efact_status === "success");
  const hasError = invoices.some((inv) => inv.efact_status === "error");

  let status: "success" | "error" | "processing";
  let label: string;
  let Icon: typeof CheckCircle2;

  if (hasSuccess) {
    status = "success";
    label = "Emitida";
    Icon = CheckCircle2;
  } else if (hasError) {
    status = "error";
    label = "Error";
    Icon = AlertCircle;
  } else {
    status = "processing";
    label = "En proceso";
    Icon = Clock;
  }

  const successInvoice = invoices.find((inv) => inv.efact_status === "success");
  const tooltipText = successInvoice
    ? `${successInvoice.full_number}`
    : `${invoices.length} comprobante${invoices.length > 1 ? "s" : ""}`;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge
          variant="outline"
          className={cn("text-xs px-2.5 py-0.5 gap-1 cursor-default", INVOICE_STATUS_COLORS[status])}
        >
          <Icon className="h-3 w-3" />
          {label}
        </Badge>
      </TooltipTrigger>
      <TooltipContent side="top">{tooltipText}</TooltipContent>
    </Tooltip>
  );
}

export function OrdersTable({ orders, basePath = '/dashboard' }: OrdersTableProps) {
  const router = useRouter();

  const handleOrderClick = (orderId: number) => {
    router.push(`${basePath}/orders/${orderId}`);
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
              <TableHead className="min-w-[60px] w-[100px]">
                CANAL
              </TableHead>
              <TableHead className="min-w-[120px]">
                ESTADO PAGO
              </TableHead>
              <TableHead className="min-w-[120px]">
                FACTURACIÓN
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
                <TableCell className="min-w-[120px]">
                  <ChannelBadge channel={order.channel} />
                </TableCell>
                <TableCell className="min-w-[120px]">
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
                <TableCell className="min-w-[120px]">
                  <InvoiceBadge invoices={order.invoices} />
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
                      <Link href={`${basePath}/orders/${order.id}`}>
                        <DropdownMenuItem>
                          <Eye className="h-4 w-4 mr-2" />
                          Ver detalles
                        </DropdownMenuItem>
                      </Link>
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`${basePath}/invoices/new?orderId=${order.id}`);
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

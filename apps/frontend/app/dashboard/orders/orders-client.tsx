"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { OrdersTable } from "@/components/dashboard/orders/orders-table";
import { EmptyState } from "@/components/ui/empty-state";
import { Order } from "@/lib/services/order-service";
import {
  Download,
  Plus,
  Search,
  ChevronLeft,
  ChevronRight
} from "lucide-react";

export interface OrderFilters {
  search: string;
  paymentStatus: string;
  channel: string;
  dateRange: string;
}

interface OrdersClientViewProps {
  initialOrders: Order[];
}

/**
 * 🎯 Client Component para la interactividad (filtros, paginación, búsqueda)
 * 
 * Este componente maneja toda la lógica del lado del cliente:
 * - Filtros de búsqueda
 * - Paginación
 * - Interacciones del usuario
 * 
 * Recibe las órdenes ya cargadas desde el Server Component
 */
export function OrdersClientView({ initialOrders }: OrdersClientViewProps) {
  const [filters, setFilters] = useState<OrderFilters>({
    search: "",
    paymentStatus: "all",
    channel: "all",
    dateRange: "30",
  });

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Filter orders based on current filters
  const filteredOrders = initialOrders.filter((order) => {
    const matchesSearch =
      (order.shopify_draft_order_id?.toLowerCase().includes(filters.search.toLowerCase()) ||
       order.shopify_order_id?.toLowerCase().includes(filters.search.toLowerCase()) ||
       order.woocommerce_order_id?.toString().includes(filters.search) ||
       order.customer_name?.toLowerCase().includes(filters.search.toLowerCase()) ||
       order.customer_email.toLowerCase().includes(filters.search.toLowerCase())) ?? false;

    const matchesPaymentStatus =
      filters.paymentStatus === "all" ||
      order.status === filters.paymentStatus;

    const matchesChannel =
      filters.channel === "all" ||
      order.channel === filters.channel;

    return matchesSearch && matchesPaymentStatus && matchesChannel;
  });

  // Pagination
  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentOrders = filteredOrders.slice(startIndex, endIndex);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold font-heading text-foreground">Listado de Pedidos</h1>
            <p className="text-muted-foreground mt-1">
              Gestiona y monitorea todas las órdenes, estados de pago y logística centralizada.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2" disabled>
              <Download className="w-4 h-4" />
              Exportar
            </Button>
            <Button className="gap-2" disabled>
              <Plus className="w-4 h-4" />
              Nuevo Pedido
            </Button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="flex-1 min-w-[250px] relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por ID de pedido o Cliente..."
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            className="pl-10"
          />
        </div>

        <Select
          value={filters.paymentStatus}
          onValueChange={(value) => setFilters({ ...filters, paymentStatus: value })}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Estado de Pago" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Estado de Pago</SelectItem>
            <SelectItem value="Pagado">Pagado</SelectItem>
            <SelectItem value="Pendiente">Pendiente</SelectItem>
            <SelectItem value="Cancelado">Cancelado</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={filters.channel}
          onValueChange={(value) => setFilters({ ...filters, channel: value })}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Canal" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Canal</SelectItem>
            <SelectItem value="venta_whatsapp">WhatsApp AI</SelectItem>
            <SelectItem value="shopify">Shopify</SelectItem>
            <SelectItem value="woocommerce">WooCommerce</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table or Empty State */}
      {filteredOrders.length === 0 ? (
        <EmptyState
          icon={<Search className="h-6 w-6" />}
          title="No se encontraron pedidos"
          description="Intenta ajustar los filtros de búsqueda o estado de pago."
          action={
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFilters({ search: "", paymentStatus: "all", channel: "all", dateRange: "30" })}
            >
              Limpiar filtros
            </Button>
          }
        />
      ) : (
        <OrdersTable orders={currentOrders} />
      )}

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Mostrando {startIndex + 1}-{Math.min(endIndex, filteredOrders.length)} de {filteredOrders.length} resultados
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>

          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            let pageNum;
            if (totalPages <= 5) {
              pageNum = i + 1;
            } else if (currentPage <= 3) {
              pageNum = i + 1;
            } else if (currentPage >= totalPages - 2) {
              pageNum = totalPages - 4 + i;
            } else {
              pageNum = currentPage - 2 + i;
            }

            return (
              <Button
                key={i}
                variant={currentPage === pageNum ? "default" : "outline"}
                size="icon"
                onClick={() => setCurrentPage(pageNum)}
              >
                {pageNum}
              </Button>
            );
          })}

          {totalPages > 5 && (
            <>
              <span className="text-muted-foreground">...</span>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentPage(totalPages)}
              >
                {totalPages}
              </Button>
            </>
          )}

          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}


"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OrdersTable } from "@/components/dashboard/orders-table";
import { mockOrders } from "@/lib/mock-data";
import { OrderFilters } from "@/lib/types/order";
import {
  Download,
  Plus,
  Search,
  ChevronLeft,
  ChevronRight
} from "lucide-react";

export default function OrdersPage() {
  const [filters, setFilters] = useState<OrderFilters>({
    search: "",
    paymentStatus: "all",
    channel: "all",
    dateRange: "30",
  });

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  // Filter orders based on current filters
  const filteredOrders = mockOrders.filter((order) => {
    const matchesSearch =
      order.id.toLowerCase().includes(filters.search.toLowerCase()) ||
      order.client.name.toLowerCase().includes(filters.search.toLowerCase()) ||
      order.client.email.toLowerCase().includes(filters.search.toLowerCase());

    const matchesPaymentStatus =
      filters.paymentStatus === "all" ||
      order.paymentStatus === filters.paymentStatus;

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
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Listado de Pedidos</h1>
            <p className="text-muted-foreground mt-1">
              Gestiona y monitorea todas las órdenes, estados de pago y logística centralizada.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2">
              <Download className="w-4 h-4" />
              Exportar
            </Button>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Nuevo Pedido
            </Button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="flex-1 min-w-[250px] relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por ID de pedido, Cliente o Empresa..."
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            className="pl-10"
          />
        </div>

        <select
          value={filters.paymentStatus}
          onChange={(e) => setFilters({ ...filters, paymentStatus: e.target.value })}
          className="px-3 py-2 border rounded-md bg-background min-w-[150px]"
        >
          <option value="all">Estado de Pago</option>
          <option value="Pagado">Pagado</option>
          <option value="Pendiente">Pendiente</option>
          <option value="Rechazado">Rechazado</option>
        </select>

        <select
          value={filters.channel}
          onChange={(e) => setFilters({ ...filters, channel: e.target.value })}
          className="px-3 py-2 border rounded-md bg-background min-w-[150px]"
        >
          <option value="all">Canal de Venta</option>
          <option value="Portal B2B">Portal B2B</option>
          <option value="WhatsApp">WhatsApp</option>
          <option value="Venta Directa">Venta Directa</option>
        </select>

        <select
          value={filters.dateRange}
          onChange={(e) => setFilters({ ...filters, dateRange: e.target.value })}
          className="px-3 py-2 border rounded-md bg-background min-w-[150px]"
        >
          <option value="7">Últimos 7 días</option>
          <option value="30">Últimos 30 días</option>
          <option value="90">Últimos 90 días</option>
          <option value="365">Último año</option>
        </select>
      </div>

      {/* Table */}
      <OrdersTable orders={currentOrders} />

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
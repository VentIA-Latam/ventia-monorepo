"use client";

import { useState, useCallback } from "react";
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
import type { Order } from "@/lib/services/order-service";
import { useServerTable } from "@/lib/hooks/use-server-table";
import {
  Download,
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from "lucide-react";

const ITEMS_PER_PAGE = 10;

interface OrdersClientViewProps {
  initialOrders: Order[];
  initialTotal: number;
}

async function fetchOrdersFromApi(
  params: Record<string, string>,
  signal: AbortSignal
): Promise<{ items: Order[]; total: number }> {
  const res = await fetch(`/api/orders?${new URLSearchParams(params)}`, { signal });
  if (!res.ok) throw new Error("Failed to fetch orders");
  return res.json();
}

export function OrdersClientView({ initialOrders, initialTotal }: OrdersClientViewProps) {
  const [search, setSearch] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("all");
  const [channel, setChannel] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);

  const { items, total, loading, isStale, fetchData, debouncedFetch } = useServerTable<Order>({
    initialItems: initialOrders,
    initialTotal,
    fetchFn: fetchOrdersFromApi,
  });

  const totalPages = Math.ceil(total / ITEMS_PER_PAGE);

  // Build params from current filter state
  const buildParams = useCallback(
    (overrides: Record<string, string> = {}) => {
      const p: Record<string, string> = {
        skip: String((currentPage - 1) * ITEMS_PER_PAGE),
        limit: String(ITEMS_PER_PAGE),
        ...overrides,
      };
      const s = overrides.search ?? search;
      const st = overrides.status ?? (paymentStatus !== "all" ? paymentStatus : "");
      const ch = overrides.channel ?? (channel !== "all" ? channel : "");
      if (s) p.search = s;
      if (st) p.status = st;
      if (ch) p.channel = ch;
      return p;
    },
    [currentPage, search, paymentStatus, channel]
  );

  // Search — debounce 300ms
  const handleSearch = (value: string) => {
    setSearch(value);
    setCurrentPage(1);
    debouncedFetch(buildParams({ search: value, skip: "0" }));
  };

  // Dropdown filters — immediate
  const handlePaymentStatus = (value: string) => {
    setPaymentStatus(value);
    setCurrentPage(1);
    fetchData(buildParams({ status: value !== "all" ? value : "", skip: "0" }));
  };

  const handleChannel = (value: string) => {
    setChannel(value);
    setCurrentPage(1);
    fetchData(buildParams({ channel: value !== "all" ? value : "", skip: "0" }));
  };

  // Pagination — immediate
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    fetchData(buildParams({ skip: String((page - 1) * ITEMS_PER_PAGE) }));
  };

  // Clear all filters
  const handleClearFilters = () => {
    setSearch("");
    setPaymentStatus("all");
    setChannel("all");
    setCurrentPage(1);
    fetchData({ skip: "0", limit: String(ITEMS_PER_PAGE) });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold font-heading text-foreground">Listado de Pedidos</h1>
            <p className="text-muted-foreground mt-1">
              Gestiona y monitorea todas las ordenes, estados de pago y logistica centralizada.
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
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        <Select value={paymentStatus} onValueChange={handlePaymentStatus}>
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

        <Select value={channel} onValueChange={handleChannel}>
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

      {/* Table */}
      <div className={isStale ? "opacity-50 pointer-events-none transition-opacity" : "transition-opacity"}>
        {loading && !isStale ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">Cargando pedidos...</span>
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={<Search className="h-6 w-6" />}
            title="No se encontraron pedidos"
            description="Intenta ajustar los filtros de busqueda o estado de pago."
            action={
              <Button variant="outline" size="sm" onClick={handleClearFilters}>
                Limpiar filtros
              </Button>
            }
          />
        ) : (
          <OrdersTable orders={items} />
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 ? (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Pagina {currentPage} de {totalPages} ({total} resultados)
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
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
                  key={pageNum}
                  variant={currentPage === pageNum ? "default" : "outline"}
                  size="icon"
                  onClick={() => handlePageChange(pageNum)}
                >
                  {pageNum}
                </Button>
              );
            })}

            <Button
              variant="outline"
              size="icon"
              onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OrdersTable } from "@/components/dashboard/orders-table";
import { Order as UIOrder, OrderFilters } from "@/lib/types/order";
import { fetchOrders, Order as BackendOrder } from "@/lib/services/order-service";
import {
  Download,
  Plus,
  Search,
  ChevronLeft,
  ChevronRight
} from "lucide-react";

// Convert currency code to symbol
function getCurrencySymbol(currency: string): string {
  const symbols: Record<string, string> = {
    'USD': '$',
    'EUR': '€',
    'GBP': '£',
    'PEN': 'S/',
    'MXN': '$',
    'ARS': '$',
    'CLP': '$',
  };
  return symbols[currency.toUpperCase()] || currency;
}

// Map backend order to UI order format
function mapBackendOrderToUI(backendOrder: BackendOrder): UIOrder {
  return {
    id: backendOrder.shopify_draft_order_id || backendOrder.id.toString(),
    date: new Date(backendOrder.created_at).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }),
    client: {
      name: backendOrder.customer_name || 'Sin nombre',
      email: backendOrder.customer_email,
    },
    channel: 'Portal B2B', // Default - puedes añadir este campo al backend después
    paymentStatus: backendOrder.status as 'Pagado' | 'Pendiente' | 'Rechazado',
    logisticsStatus: 'Procesando', // Default - puedes añadir este campo al backend después
    amount: backendOrder.total_price,
    currency: getCurrencySymbol(backendOrder.currency),
  };
}

export default function OrdersPage() {
  const [filters, setFilters] = useState<OrderFilters>({
    search: "",
    paymentStatus: "all",
    channel: "all",
    dateRange: "30",
  });

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;
  const [orders, setOrders] = useState<UIOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch orders from backend
  useEffect(() => {
    async function loadOrders() {
      try {
        setLoading(true);
        // Get access token from debug endpoint (in dev)
        const tokenResponse = await fetch('/api/debug/token');
        if (!tokenResponse.ok) {
          throw new Error('Not authenticated');
        }
        const tokenData = await tokenResponse.json();
        const accessToken = tokenData.accessToken;

        // Fetch orders from backend
        const response = await fetchOrders(accessToken, {
          skip: 0,
          limit: 100,
        });

        // Map backend orders to UI format
        const mappedOrders = response.items.map(mapBackendOrderToUI);
        setOrders(mappedOrders);
        setError(null);
      } catch (err) {
        console.error('Error loading orders:', err);
        setError(err instanceof Error ? err.message : 'Error loading orders');
      } finally {
        setLoading(false);
      }
    }

    loadOrders();
  }, []);

  // Filter orders based on current filters
  const filteredOrders = orders.filter((order) => {
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
    <div className="space-y-6">
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

      {/* Error Message */}
      {error && (
        <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-lg">
          <p className="font-semibold">Error al cargar órdenes</p>
          <p className="text-sm">{error}</p>
        </div>
      )}

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

{/*         <select
          value={filters.channel}
          onChange={(e) => setFilters({ ...filters, channel: e.target.value })}
          className="px-3 py-2 border rounded-md bg-background min-w-[150px]"
        >
          <option value="all">Canal de Venta</option>
          <option value="Portal B2B">Portal B2B</option>
          <option value="WhatsApp">WhatsApp</option>
          <option value="Venta Directa">Venta Directa</option>
        </select> */}

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

      {/* Loading State */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Cargando órdenes...</p>
          </div>
        </div>
      ) : (
        <>
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
        </>
      )}
    </div>
  );
}
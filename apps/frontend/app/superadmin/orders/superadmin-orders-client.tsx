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
import { TenantSelector, type TenantOption } from "@/components/superadmin/tenant-selector";
import { getOrdersByTenant } from "@/lib/api-client/superadmin";
import type { Order } from "@/lib/services/order-service";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from "lucide-react";

interface SuperAdminOrdersClientProps {
  tenants: TenantOption[];
  initialOrders: Order[];
}

export function SuperAdminOrdersClient({
  tenants,
  initialOrders,
}: SuperAdminOrdersClientProps) {
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [selectedTenant, setSelectedTenant] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("all");
  const [channel, setChannel] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // rerender-functional-setstate: stable callback
  const handleTenantChange = useCallback(async (tenantId: number | null) => {
    setSelectedTenant(tenantId);
    setCurrentPage(1);
    setLoading(true);
    try {
      const data = await getOrdersByTenant(tenantId ?? undefined, 100);
      setOrders(data.items);
    } catch (error) {
      console.error("Error fetching orders:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Filter orders client-side
  const filteredOrders = orders.filter((order) => {
    const matchesSearch =
      !search ||
      order.shopify_draft_order_id?.toLowerCase().includes(search.toLowerCase()) ||
      order.shopify_order_id?.toLowerCase().includes(search.toLowerCase()) ||
      order.woocommerce_order_id?.toString().includes(search) ||
      order.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
      order.customer_email.toLowerCase().includes(search.toLowerCase());

    const matchesPayment =
      paymentStatus === "all" || order.status === paymentStatus;

    const matchesChannel =
      channel === "all" || order.channel === channel;

    return matchesSearch && matchesPayment && matchesChannel;
  });

  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentOrders = filteredOrders.slice(startIndex, startIndex + itemsPerPage);

  // Build tenant name map for display
  const tenantMap = new Map(tenants.map((t) => [t.id, t.name]));

  return (
    <div className="space-y-6">
      {/* Tenant Selector */}
      <TenantSelector
        tenants={tenants}
        value={selectedTenant}
        onChange={handleTenantChange}
      />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por ID de pedido o cliente..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
            className="pl-10"
          />
        </div>

        <Select value={paymentStatus} onValueChange={(v) => { setPaymentStatus(v); setCurrentPage(1); }}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Estado de Pago" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Estado de Pago</SelectItem>
            <SelectItem value="Pagado">Pagado</SelectItem>
            <SelectItem value="Pendiente">Pendiente</SelectItem>
            <SelectItem value="Cancelado">Cancelado</SelectItem>
          </SelectContent>
        </Select>

        <Select value={channel} onValueChange={(v) => { setChannel(v); setCurrentPage(1); }}>
          <SelectTrigger className="w-full sm:w-[180px]">
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
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Cargando pedidos...</span>
        </div>
      ) : filteredOrders.length === 0 ? (
        <EmptyState
          icon={<Search className="h-6 w-6" />}
          title="No se encontraron pedidos"
          description={
            selectedTenant
              ? `No hay pedidos para ${tenantMap.get(selectedTenant) || "este tenant"}.`
              : "No hay pedidos que coincidan con los filtros."
          }
          action={
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearch("");
                setPaymentStatus("all");
                setChannel("all");
              }}
            >
              Limpiar filtros
            </Button>
          }
        />
      ) : (
        <OrdersTable orders={currentOrders} basePath="/superadmin" />
      )}

      {/* Pagination */}
      {!loading && filteredOrders.length > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Mostrando {startIndex + 1}-{Math.min(startIndex + itemsPerPage, filteredOrders.length)} de {filteredOrders.length} resultados
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
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
                  onClick={() => setCurrentPage(pageNum)}
                >
                  {pageNum}
                </Button>
              );
            })}

            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { Order } from "@/lib/services/order-service"
import { useRouter } from "next/navigation"

interface RecentActivityTableProps {
  orders: Order[];
}

export function RecentActivityTable({ orders }: RecentActivityTableProps) {
  const router = useRouter();

  const getEstadoColor = (estado: string) => {
    switch (estado) {
      case "Pagado":
        return "bg-green-50 text-green-700 border-green-200"
      case "Pendiente":
        return "bg-orange-50 text-orange-700 border-orange-200"
      default:
        return "bg-gray-50 text-gray-700 border-gray-200"
    }
  }

  const handleViewOrder = (orderId: number) => {
    router.push(`/dashboard/orders/${orderId}`);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">Actividad Reciente</h2>
        <Button
          variant="link"
          className="text-blue-600"
          onClick={() => router.push('/dashboard/orders')}
        >
          Ver todo
        </Button>
      </div>

      <div className="border rounded-xl bg-white shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50/60">
              <TableHead className="text-xs font-semibold uppercase pl-5">ID Pedido</TableHead>
              <TableHead className="text-xs font-semibold uppercase">Cliente</TableHead>
              <TableHead className="text-xs font-semibold uppercase">Fecha</TableHead>
              <TableHead className="text-xs font-semibold uppercase">Monto</TableHead>
              <TableHead className="text-xs font-semibold uppercase">Estado</TableHead>
              <TableHead className="text-xs font-semibold uppercase">Acción</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                  No hay pedidos recientes.
                </TableCell>
              </TableRow>
            ) : (
              orders.map((order) => (
                <TableRow key={order.id} className="hover:bg-slate-50/60">
                  <TableCell className="font-medium text-sm pl-5">
                    {order.shopify_draft_order_id}
                  </TableCell>
                  <TableCell className="text-sm text-gray-700">
                    {order.customer_name || 'Sin nombre'}
                  </TableCell>
                  <TableCell className="text-sm text-gray-600">
                    {formatDate(order.created_at)}
                  </TableCell>
                  <TableCell className="text-sm font-semibold">
                    {order.currency} {order.total_price.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-blue-600 hover:text-blue-700"
                      onClick={() => handleViewOrder(order.id)}
                    >
                      Ver
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

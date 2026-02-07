"use client";

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn, formatDate, getEcommerceOrderId } from "@/lib/utils"
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
        return "bg-success-bg text-success border-success/30"
      case "Pendiente":
        return "bg-warning-bg text-warning border-warning/30"
      default:
        return "bg-muted text-muted-foreground border-border"
    }
  }

  const handleViewOrder = (orderId: number) => {
    router.push(`/dashboard/orders/${orderId}`);
  };



  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-foreground">Actividad Reciente</h2>
        <Button
          variant="link"
          className="text-volt"
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
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  No hay pedidos recientes.
                </TableCell>
              </TableRow>
            ) : (
              orders.map((order) => (
                <TableRow key={order.id} className="hover:bg-slate-50/60">
                  <TableCell className="font-medium text-sm pl-5">
                    {getEcommerceOrderId(order)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {order.customer_name || 'Sin nombre'}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
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
                      className="text-volt hover:text-volt/80"
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

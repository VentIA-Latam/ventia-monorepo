"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Order } from "@/lib/types/order";
import { useRecentActivity } from "@/contexts/RecentActivityContext";
import { useRouter } from "next/navigation";

interface OrdersTableProps {
  orders: Order[];
}

const channelIcons: Record<Order['channel'], string> = {
  'Portal B2B': '🏢',
  'WhatsApp': '💬',
  'Venta Directa': '🏪',
};

const paymentStatusVariants: Record<Order['paymentStatus'], "default" | "secondary" | "destructive"> = {
  'Pagado': 'default',
  'Pendiente': 'secondary',
  'Rechazado': 'destructive',
};

const logisticsStatusVariants: Record<Order['logisticsStatus'], "default" | "secondary" | "destructive" | "outline"> = {
  'En camino': 'default',
  'Procesando': 'secondary',
  'Entregado': 'default',
  'Cancelado': 'destructive',
};

export function OrdersTable({ orders }: OrdersTableProps) {
  const { addActivity } = useRecentActivity();
  const router = useRouter();

  const handleOrderClick = (order: Order) => {
    // Register activity
    addActivity({
      id: `${order.id}-${Date.now()}`,
      orderId: order.id,
      orderDbId: order.dbId, // Usar el ID real de la base de datos
      cliente: order.client.name,
      email: order.client.email,
      fecha: order.date,
      monto: `${order.currency}${order.amount.toLocaleString()}`,
      estado: order.paymentStatus,
      accion: 'viewed',
    });

    // Navigate to order detail page usando el ID real de la BD
    router.push(`/dashboard/orders/${order.dbId}`);
  };

  return (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="w-12">
              <input type="checkbox" className="rounded" />
            </TableHead>
            <TableHead className="font-semibold text-muted-foreground">
              ID PEDIDO
            </TableHead>
            <TableHead className="font-semibold text-muted-foreground">
              CLIENTE
            </TableHead>
            {/*             <TableHead className="font-semibold text-muted-foreground">
              CANAL
            </TableHead> */}
            <TableHead className="font-semibold text-muted-foreground">
              ESTADO PAGO
            </TableHead>
            {/* <TableHead className="font-semibold text-muted-foreground">
              LOGÍSTICA
            </TableHead> */}
            <TableHead className="font-semibold text-muted-foreground text-right">
              MONTO
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map((order) => (
            <TableRow
              key={order.id}
              className="hover:bg-muted/50 cursor-pointer"
              onClick={() => handleOrderClick(order)}
            >
              <TableCell onClick={(e) => e.stopPropagation()}>
                <input type="checkbox" className="rounded" />
              </TableCell>
              <TableCell>
                <div>
                  <div className="font-semibold text-primary hover:underline cursor-pointer">
                    {order.id}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {order.date}
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center font-semibold text-sm">
                    {order.client.name.substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className="font-medium">{order.client.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {order.client.email}
                    </div>
                  </div>
                </div>
              </TableCell>
              {/*               <TableCell>
                <div className="flex items-center gap-2">
                  <span>{channelIcons[order.channel]}</span>
                  <span className="text-sm">{order.channel}</span>
                </div>
              </TableCell> */}
              <TableCell>
                <Badge
                  variant={paymentStatusVariants[order.paymentStatus]}
                  className={
                    order.paymentStatus === 'Pagado'
                      ? 'bg-green-50 text-green-700 border-green-200'
                      : order.paymentStatus === 'Pendiente'
                        ? 'bg-orange-50 text-orange-700 border-orange-200'
                        : ''
                  }
                >
                  {order.paymentStatus}
                </Badge>
              </TableCell>
              {/*               
              <TableCell>
                <Badge
                  variant={logisticsStatusVariants[order.logisticsStatus]}
                  className={
                    order.logisticsStatus === 'Entregado'
                      ? 'bg-blue-500 hover:bg-blue-600'
                      : order.logisticsStatus === 'Procesando'
                        ? 'bg-gray-500 hover:bg-gray-600'
                        : order.logisticsStatus === 'En camino'
                          ? 'bg-cyan-500 hover:bg-cyan-600'
                          : ''
                  }
                >
                  {order.logisticsStatus}
                </Badge>
              </TableCell> */}
              <TableCell className="text-right font-semibold">
                {order.currency}{order.amount.toLocaleString()}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

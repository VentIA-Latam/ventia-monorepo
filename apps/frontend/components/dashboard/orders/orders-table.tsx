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
import { useRouter } from "next/navigation";

interface OrdersTableProps {
  orders: Order[];
}


// Función helper para obtener color de avatar basado en iniciales
const getAvatarColor = (name: string) => {
  const colors = [
    'bg-blue-100 text-blue-700',
    'bg-purple-100 text-purple-700',
    'bg-green-100 text-green-700',
    'bg-orange-100 text-orange-700',
    'bg-pink-100 text-pink-700',
    'bg-cyan-100 text-cyan-700',
  ];
  const index = name.charCodeAt(0) % colors.length;
  return colors[index];
};

export function OrdersTable({ orders }: OrdersTableProps) {
  const router = useRouter();

  const handleOrderClick = (orderDbId: number) => {
    // Navigate to order detail page usando el ID real de la BD
    router.push(`/dashboard/orders/${orderDbId}`);
  };

  return (
    <div className="border rounded-lg bg-white shadow-sm overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-gray-50/80 border-b border-gray-200">
            <TableHead>
              ID PEDIDO
            </TableHead>
            <TableHead>
              CLIENTE
            </TableHead>
            <TableHead>
              ESTADO PAGO
            </TableHead>
            <TableHead className="text-right">
              MONTO
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map((order) => (
            <TableRow
              key={order.id}
              className="hover:bg-gray-50/50 cursor-pointer transition-colors border-b border-gray-100 last:border-0"
              onClick={() => handleOrderClick(order.dbId)}
            >
              <TableCell>
                <div>
                  <div className="font-semibold text-blue-600 hover:underline cursor-pointer text-sm">
                    {order.id}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {order.date}
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm ${getAvatarColor(order.client.name)}`}>
                    {order.client.name.substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className="font-medium text-sm text-gray-900">{order.client.name}</div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {order.client.email}
                    </div>
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <Badge
                  variant="secondary"
                  className={
                    order.paymentStatus === 'Pagado'
                      ? 'bg-green-100 text-green-700 border-0 hover:bg-green-100 rounded-md px-3 py-1'
                      : order.paymentStatus === 'Pendiente'
                        ? 'bg-yellow-100 text-yellow-700 border-0 hover:bg-yellow-100 rounded-md px-3 py-1'
                        : 'bg-red-100 text-red-700 border-0 hover:bg-red-100 rounded-md px-3 py-1'
                  }
                >
                  {order.paymentStatus}
                </Badge>
              </TableCell>
              <TableCell className="text-right font-semibold text-sm text-gray-900">
                {order.currency}{order.amount.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

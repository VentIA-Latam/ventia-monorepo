import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { recentActivity, type RecentActivity } from "@/lib/mock-data"

export function RecentActivityTable() {
  const getEstadoColor = (estado: RecentActivity["estado"]) => {
    switch (estado) {
      case "Pagado":
        return "bg-green-50 text-green-700 border-green-200"
      case "Pendiente":
        return "bg-orange-50 text-orange-700 border-orange-200"
      case "Enviado":
        return "bg-blue-50 text-blue-700 border-blue-200"
      case "Cancelado":
        return "bg-red-50 text-red-700 border-red-200"
      default:
        return "bg-gray-50 text-gray-700 border-gray-200"
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">Actividad Reciente</h2>
        <Button variant="link" className="text-blue-600">
          Ver todo
        </Button>
      </div>

      <div className="border rounded-xl bg-white shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50/60">
              <TableHead className="text-xs font-semibold uppercase">ID Pedido</TableHead>
              <TableHead className="text-xs font-semibold uppercase">Cliente</TableHead>
              <TableHead className="text-xs font-semibold uppercase">Fecha</TableHead>
              <TableHead className="text-xs font-semibold uppercase">Monto</TableHead>
              <TableHead className="text-xs font-semibold uppercase">Estado</TableHead>
              <TableHead className="text-xs font-semibold uppercase">Acción</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {recentActivity.map((activity) => (
              <TableRow key={activity.id} className="hover:bg-slate-50/60">
                <TableCell className="font-medium text-sm">
                  {activity.id}
                </TableCell>
                <TableCell className="text-sm text-gray-700">
                  {activity.cliente}
                </TableCell>
                <TableCell className="text-sm text-gray-600">
                  {activity.fecha}
                </TableCell>
                <TableCell className="text-sm font-semibold">
                  {activity.monto}
                </TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-xs px-3 py-0.5",
                      getEstadoColor(activity.estado)
                    )}
                  >
                    {activity.estado}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="sm" className="text-blue-600 hover:text-blue-700">
                    Ver
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

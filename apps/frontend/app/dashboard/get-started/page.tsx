import { StatsCard } from "@/components/dashboard/stats-card";
import { RecentActivityTable } from "@/components/dashboard/recent-activity-table"
import { ShoppingBag, AlertCircle, Truck, DollarSign } from "lucide-react"

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-ventia-blue font-libre-franklin">
          Dashboard General
        </h1>
        <p className="text-gray-600 mt-2 font-inter">
          Bienvenido de nuevo, aquí tienes un resumen de la operación de hoy
        </p>
      </div>

      {/* Grid de 4 tarjetas de estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Total Pedidos"
          value="1,245"
          icon={<ShoppingBag className="w-5 h-5" />}
          change="+5%"
          changeType="positive"
          comparison="vs. ayer"
        />

        <StatsCard
          title="Pendientes de Pago"
          value="12"
          icon={<AlertCircle className="w-5 h-5" />}
          badge="Requieren atención"
          badgeType="warning"
        />

        <StatsCard
          title="Por Despachar"
          value="8"
          icon={<Truck className="w-5 h-5" />}
          badge="Prioridad Alta"
          badgeType="info"
        />

        <StatsCard
          title="Ventas (Hoy)"
          value="$4,250"
          icon={<DollarSign className="w-5 h-5" />}
          change="+12%"
          changeType="positive"
          comparison="vs. ayer"
        />
      </div>

      {/* Tabla de actividad reciente */}
      <RecentActivityTable />
    </div>
  )
}

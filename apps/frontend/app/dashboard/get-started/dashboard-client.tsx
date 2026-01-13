"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { StatsCard } from "@/components/dashboard/stats-card";
import { ShoppingBag, AlertCircle, Truck, DollarSign } from "lucide-react";
import { DashboardMetrics, PeriodType } from "@/lib/services/metrics-service";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface DashboardClientProps {
  initialMetrics: DashboardMetrics;
}

const PERIOD_LABELS: Record<PeriodType, string> = {
  'today': 'Hoy',
  'yesterday': 'Ayer',
  'last_7_days': 'Últimos 7 días',
  'last_30_days': 'Últimos 30 días',
  'this_month': 'Este mes',
  'last_month': 'Mes pasado',
  'custom': 'Personalizado',
};

/**
 * Client Component para dashboard con métricas reales
 * Maneja la selección de periodo y refresco automático
 */
export function DashboardClient({ initialMetrics }: DashboardClientProps) {
  const router = useRouter();
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>(initialMetrics.period);

  // Formatear moneda
  const formatCurrency = (amount: number, currency: string) => {
    const symbols: Record<string, string> = {
      'USD': '$',
      'EUR': '€',
      'GBP': '£',
      'PEN': 'S/',
    };
    return `${symbols[currency] || currency}${amount.toLocaleString('es-ES', { minimumFractionDigits: 2 })}`;
  };

  // Manejar cambio de periodo
  const handlePeriodChange = (newPeriod: PeriodType) => {
    setSelectedPeriod(newPeriod);
    // Actualizar URL y refrescar datos del servidor
    router.push(`/dashboard/get-started?period=${newPeriod}`);
    router.refresh();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-ventia-blue font-libre-franklin">
            Dashboard General
          </h1>
          <p className="text-sm sm:text-base text-gray-600 mt-1 sm:mt-2 font-inter">
            Bienvenido de nuevo, aquí tienes un resumen de la operación
          </p>
        </div>

        {/* Selector de periodo */}
        <div className="flex items-center gap-2">
          <label className="text-xs sm:text-sm font-medium text-muted-foreground">
            Periodo:
          </label>
          <Select
            value={selectedPeriod}
            onValueChange={(value) => handlePeriodChange(value as PeriodType)}
          >
            <SelectTrigger className="px-2 py-1.5 sm:px-4 sm:py-2 border rounded-lg bg-background w-auto sm:min-w-[180px] font-medium text-xs sm:text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(PERIOD_LABELS).map(([value, label]) => (
                value !== 'custom' && (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                )
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Grid de 4 tarjetas de estadísticas con datos REALES */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatsCard
          title="Total Pedidos"
          value={initialMetrics.total_orders.toLocaleString('es-PE')}
          icon={<ShoppingBag className="w-5 h-5" />}
          // change="+5%"  // TODO: Calcular cambio vs periodo anterior
          // changeType="positive"
          comparison={`del ${new Date(initialMetrics.start_date).toLocaleDateString('es-ES')} al ${new Date(initialMetrics.end_date).toLocaleDateString('es-ES')}`}
        />

        <StatsCard
          title="Pendientes de Pago"
          value={initialMetrics.pending_payment.toString()}
          icon={<AlertCircle className="w-5 h-5" />}
          badge={initialMetrics.pending_payment > 0 ? "Requieren atención" : "Todo al día"}
          badgeType={initialMetrics.pending_payment > 0 ? "warning" : "success"}
        />

        <StatsCard
          title={`Ventas (${PERIOD_LABELS[selectedPeriod]})`}
          value={formatCurrency(initialMetrics.total_sales, initialMetrics.currency)}
          icon={<DollarSign className="w-5 h-5" />}
          // change="+12%"  // TODO: Calcular cambio vs periodo anterior
          // changeType="positive"
          comparison="solo órdenes validadas"
        />
      </div>
    </div>
  );
}

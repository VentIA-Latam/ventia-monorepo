"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { StatsCard } from "@/components/dashboard/stats-card";
import { ShoppingBag, AlertCircle, DollarSign } from "lucide-react";
import { DashboardMetrics, PeriodType } from "@/lib/services/metrics-service";
import { formatDate } from "@/lib/utils";
import { motion } from "framer-motion";
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

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Buenos días";
  if (hour < 18) return "Buenas tardes";
  return "Buenas noches";
}

export function DashboardClient({ initialMetrics }: DashboardClientProps) {
  const router = useRouter();
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>(initialMetrics.period);

  const formatCurrency = (amount: number, currency: string) => {
    const symbols: Record<string, string> = {
      'USD': '$',
      'EUR': '€',
      'GBP': '£',
      'PEN': 'S/',
    };
    return `${symbols[currency] || currency}${amount.toLocaleString('es-ES', { minimumFractionDigits: 2 })}`;
  };

  const handlePeriodChange = (newPeriod: PeriodType) => {
    setSelectedPeriod(newPeriod);
    router.push(`/dashboard/get-started?period=${newPeriod}`);
    router.refresh();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-marino font-heading">
            {getGreeting()} 👋
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1 sm:mt-2">
            Aquí tienes un resumen de la operación
          </p>
        </div>

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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          {
            title: "Total Pedidos",
            value: initialMetrics.total_orders.toLocaleString('es-PE'),
            icon: <ShoppingBag className="w-5 h-5" />,
            comparison: `del ${formatDate(initialMetrics.start_date)} al ${formatDate(initialMetrics.end_date)}`,
            accentColor: "volt" as const,
          },
          {
            title: "Pendientes de Pago",
            value: initialMetrics.pending_payment.toString(),
            icon: <AlertCircle className="w-5 h-5" />,
            badge: initialMetrics.pending_payment > 0 ? "Requieren atención" : "Todo al día",
            badgeType: (initialMetrics.pending_payment > 0 ? "warning" : "success") as "warning" | "success",
            accentColor: "warning" as const,
          },
          {
            title: `Ventas (${PERIOD_LABELS[selectedPeriod]})`,
            value: formatCurrency(initialMetrics.total_sales, initialMetrics.currency),
            icon: <DollarSign className="w-5 h-5" />,
            comparison: "solo órdenes validadas",
            accentColor: "success" as const,
          },
        ].map((card, i) => (
          <motion.div
            key={card.title}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: i * 0.1, ease: "easeOut" }}
          >
            <StatsCard {...card} />
          </motion.div>
        ))}
      </div>
    </div>
  );
}

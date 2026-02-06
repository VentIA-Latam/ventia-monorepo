"use client";

import { useCallback, useState, useTransition } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import {
  ShoppingCart,
  CreditCard,
  DollarSign,
  Calendar,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import type {
  TopProductsResponse,
  OrdersByCityResponse,
  DashboardMetrics,
  PeriodType,
} from "@/lib/services/metrics-service";

const ProductosMasVendidos = dynamic(
  () => import("@/components/metrics/ProductosMasVendidos"),
  {
    ssr: false,
    loading: () => <Skeleton className="h-80 rounded-lg" />,
  }
);

const Mapa = dynamic(() => import("@/components/metrics/Mapa"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
      Cargando mapa...
    </div>
  ),
});

const PERIOD_OPTIONS: { value: PeriodType; label: string }[] = [
  { value: "today", label: "Hoy" },
  { value: "yesterday", label: "Ayer" },
  { value: "last_7_days", label: "Últimos 7 días" },
  { value: "last_30_days", label: "Últimos 30 días" },
  { value: "this_month", label: "Este mes" },
  { value: "last_month", label: "Mes anterior" },
];

interface MetricsClientProps {
  topProducts: TopProductsResponse;
  ordersByCity: OrdersByCityResponse;
  dashboardMetrics: DashboardMetrics;
  initialPeriod: PeriodType;
}

function formatCurrencyValue(amount: number, currency: string) {
  const symbol = currency === "PEN" ? "S/" : "$";
  return `${symbol} ${new Intl.NumberFormat("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)}`;
}

export function MetricsClient({
  topProducts,
  ordersByCity,
  dashboardMetrics,
  initialPeriod,
}: MetricsClientProps) {
  const [period, setPeriod] = useState<PeriodType>(initialPeriod);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handlePeriodChange = useCallback(
    (value: string) => {
      setPeriod(value as PeriodType);
      startTransition(() => {
        router.push(`/dashboard/metrics?period=${value}`);
        router.refresh();
      });
    },
    [router]
  );

  const kpis = [
    {
      title: "Total Pedidos",
      value: dashboardMetrics.total_orders.toString(),
      icon: ShoppingCart,
      color: "text-volt bg-volt/10",
    },
    {
      title: "Pago Pendiente",
      value: dashboardMetrics.pending_payment.toString(),
      icon: CreditCard,
      color: "text-warning bg-warning-bg",
    },
    {
      title: "Ventas Totales",
      value: formatCurrencyValue(
        dashboardMetrics.total_sales,
        dashboardMetrics.currency
      ),
      icon: DollarSign,
      color: "text-success bg-success-bg",
    },
  ];

  return (
    <div className={`space-y-6 ${isPending ? "opacity-70 pointer-events-none" : ""}`} style={{ transition: "opacity 150ms" }}>
      {/* Header + Period selector */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold font-heading">Métricas</h1>
          <p className="text-muted-foreground">
            Visualiza el rendimiento de tu negocio.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <Select value={period} onValueChange={handlePeriodChange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIOD_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {kpis.map((kpi) => (
          <Card key={kpi.title} className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardDescription className="text-sm font-medium">
                {kpi.title}
              </CardDescription>
              <div className={`rounded-lg p-2 ${kpi.color}`}>
                <kpi.icon className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tabular-nums">
                {kpi.value}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts: Products + Map */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <ProductosMasVendidos data={topProducts.data} />

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Distribución Geográfica
            </CardTitle>
            <CardDescription>
              Mapa de calor por distritos de Lima
            </CardDescription>
          </CardHeader>
          <CardContent className="h-[500px] p-4 pt-0">
            <Mapa data={ordersByCity.data} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

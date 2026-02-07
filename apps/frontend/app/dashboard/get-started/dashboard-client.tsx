"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { StatsCard } from "@/components/dashboard/stats-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ShoppingBag,
  AlertCircle,
  DollarSign,
  Trophy,
  Package,
  Clock,
  CheckCircle2,
  Calendar,
  MapPin,
} from "lucide-react";
import { DashboardMetrics, PeriodType } from "@/lib/services/metrics-service";
import type { TopProduct, CityOrderCount } from "@/lib/services/metrics-service";
import type { Order } from "@/lib/services/order-service";
import { formatDate, getEcommerceOrderId, getCurrencySymbol, cn } from "@/lib/utils";
import { motion } from "framer-motion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Dynamic import for Leaflet map (heavy client-only lib)
const SalesMap = dynamic(
  () => import("@/components/metrics/sales-map").then((mod) => ({ default: mod.SalesMap })),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-[400px] text-sm text-muted-foreground">
        <MapPin className="h-5 w-5 animate-pulse mr-2" />
        Cargando mapa...
      </div>
    ),
  }
);

interface DashboardClientProps {
  initialMetrics: DashboardMetrics;
  recentOrders: Order[];
  topProducts: TopProduct[];
  ordersByCity: CityOrderCount[];
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

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35 } },
};

// --- Sub-components ---

function RecentOrdersCard({ orders }: { orders: Order[] }) {
  const router = useRouter();

  const getStatusStyle = (status: string) => {
    switch (status) {
      case "Pagado": return "bg-success-bg text-success border-success/30";
      case "Pendiente": return "bg-warning-bg text-warning border-warning/30";
      case "Cancelado": return "bg-danger-bg text-danger border-danger/30";
      default: return "bg-muted text-muted-foreground border-border";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "Pagado": return <CheckCircle2 className="h-3.5 w-3.5 text-success" />;
      case "Pendiente": return <Clock className="h-3.5 w-3.5 text-warning" />;
      default: return <Package className="h-3.5 w-3.5 text-muted-foreground" />;
    }
  };

  return (
    <Card className="flex flex-col w-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">Actividad reciente</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 pt-0">
        {orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <Package className="h-8 w-8 text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">Sin pedidos recientes</p>
          </div>
        ) : (
          <div className="space-y-1">
            {orders.map((order) => (
              <div
                key={order.id}
                onClick={() => router.push(`/dashboard/orders/${order.id}`)}
                className="flex items-center gap-3 p-2.5 -mx-1 rounded-lg hover:bg-muted/60 cursor-pointer transition-colors group"
              >
                {/* Status icon */}
                <div className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                  order.status === "Pagado" ? "bg-success-bg" : order.status === "Pendiente" ? "bg-warning-bg" : "bg-muted"
                )}>
                  {getStatusIcon(order.status)}
                </div>

                {/* Order info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground truncate">
                      {order.customer_name || "Sin nombre"}
                    </span>
                    <Badge
                      variant="outline"
                      className={cn("text-[10px] px-1.5 py-0 h-4 shrink-0", getStatusStyle(order.status))}
                    >
                      {order.status}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-muted-foreground">
                      {getEcommerceOrderId(order)}
                    </span>
                    <span className="text-xs text-muted-foreground/50">·</span>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(order.created_at)}
                    </span>
                  </div>
                </div>

                {/* Amount */}
                <span className="text-sm font-semibold tabular-nums text-foreground shrink-0">
                  {getCurrencySymbol(order.currency)}{order.total_price.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TopProductsRanking({ products }: { products: TopProduct[] }) {
  if (products.length === 0) {
    return (
      <Card className="flex flex-col w-full">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Top productos</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex items-center justify-center pt-0">
          <div className="flex flex-col items-center py-10 text-center">
            <Trophy className="h-8 w-8 text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">Sin datos de productos</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const sorted = [...products].sort((a, b) => b.total_sold - a.total_sold);
  const maxSold = sorted[0]?.total_sold || 1;

  const medalColors = [
    "bg-warning/15 text-warning border-warning/20",
    "bg-muted/80 text-muted-foreground border-border",
    "bg-volt/10 text-volt border-volt/20",
  ];

  return (
    <Card className="flex flex-col w-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">Top productos</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 pt-0 space-y-5">
        {sorted.slice(0, 7).map((product, i) => {
          const pct = (product.total_sold / maxSold) * 100;
          return (
            <div key={product.product} className="space-y-1.5">
              <div className="flex items-center justify-between gap-2 pt-2.5">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  {i < 3 ? (
                    <span className={cn(
                      "flex h-5 w-5 shrink-0 items-center justify-center rounded text-[10px] font-bold border",
                      medalColors[i]
                    )}>
                      {i + 1}
                    </span>
                  ) : (
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center text-[10px] font-medium text-muted-foreground">
                      {i + 1}
                    </span>
                  )}
                  <span className="text-sm text-foreground truncate">{product.product}</span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs text-muted-foreground tabular-nums">{product.total_sold} uds</span>
                  <span className="text-xs font-semibold tabular-nums text-foreground min-w-[70px] text-right">
                    S/{product.total_revenue.toLocaleString('es-PE', { minimumFractionDigits: 0 })}
                  </span>
                </div>
              </div>
              {/* Progress bar */}
              <div className="h-1.5 rounded-full bg-muted/60 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-volt to-aqua transition-all duration-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

// --- Main Dashboard ---

export function DashboardClient({ initialMetrics, recentOrders, topProducts, ordersByCity }: DashboardClientProps) {
  const router = useRouter();
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>(initialMetrics.period);

  const formatCurrency = (amount: number, currency: string) => {
    const symbols: Record<string, string> = {
      'USD': '$', 'EUR': '€', 'GBP': '£', 'PEN': 'S/',
    };
    return `${symbols[currency] || currency}${amount.toFixed(2)}`;
  };

  const handlePeriodChange = (newPeriod: PeriodType) => {
    setSelectedPeriod(newPeriod);
    router.push(`/dashboard/get-started?period=${newPeriod}`);
    router.refresh();
  };

  // Quick status summary
  const paidOrders = recentOrders.filter(o => o.status === "Pagado").length;
  const pendingOrders = recentOrders.filter(o => o.status === "Pendiente").length;

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={stagger}
      className="space-y-6"
    >
      {/* Header */}
      <motion.div variants={fadeUp} className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground font-heading">
            {getGreeting()}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Resumen de operación · {PERIOD_LABELS[selectedPeriod]}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground hidden sm:block" />
          <Select
            value={selectedPeriod}
            onValueChange={(value) => handlePeriodChange(value as PeriodType)}
          >
            <SelectTrigger className="w-auto sm:min-w-[170px] h-9 text-sm font-medium">
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
      </motion.div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
          <motion.div key={i} variants={fadeUp}>
            <StatsCard {...card} />
          </motion.div>
        ))}
      </div>

      {/* Quick status strip */}
      {recentOrders.length > 0 && (
        <motion.div variants={fadeUp} className="flex items-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-success" />
            <span>{paidOrders} pagado{paidOrders !== 1 ? 's' : ''}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-warning" />
            <span>{pendingOrders} pendiente{pendingOrders !== 1 ? 's' : ''}</span>
          </div>
          <div className="h-3 w-px bg-border" />
          <span>últimos {recentOrders.length} pedidos</span>
        </motion.div>
      )}

      {/* Two-column: Recent Orders + Top Products Ranking */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <motion.div variants={fadeUp} className="flex">
          <RecentOrdersCard orders={recentOrders} />
        </motion.div>
        <motion.div variants={fadeUp} className="flex">
          <TopProductsRanking products={topProducts} />
        </motion.div>
      </div>

      {/* Sales Map */}
      <motion.div variants={fadeUp}>
        <Card className="flex flex-col">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base font-semibold">Mapa de ventas</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="flex-1 pt-0">
            <div className="h-[450px] rounded-lg overflow-hidden">
              <SalesMap data={ordersByCity} />
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}

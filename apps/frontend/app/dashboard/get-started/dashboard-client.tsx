"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTenantTimezone } from "@/lib/context/timezone-context";
import dynamic from "next/dynamic";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { StatsCard } from "@/components/dashboard/stats-card";
import { NoPurchaseReasonsRanking } from "@/components/dashboard/no-purchase-reasons-ranking";
import { AdsSummaryWidget } from "@/components/dashboard/ads-summary-widget";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DatePicker } from "@/components/ui/date-picker";
import {
  ShoppingBag,
  AlertCircle,
  DollarSign,
  Trophy,
  Package,
  Clock,
  CheckCircle2,
  MapPin,
  TrendingUp,
  RotateCcw,
  MessageSquare,
} from "lucide-react";
import { DashboardMetrics, ConversionRate } from "@/lib/services/metrics-service";
import type { TopProduct, CityOrderCount, NoPurchaseReasonsResponse, AdsSummaryResponse } from "@/lib/services/metrics-service";
import type { Order } from "@/lib/services/order-service";
import { formatDate, getEcommerceOrderId, getCurrencySymbol, cn, toLocalDateStr } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

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
  initialConversionRate: ConversionRate;
  conversationCount: number;
  noPurchaseReasons?: NoPurchaseReasonsResponse;
  adsSummary?: AdsSummaryResponse;
  startDate: string;
  endDate: string;
  defaultStartDate: string;
  defaultEndDate: string;
}

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

const CURRENCY_SYMBOLS: Record<string, string> = { USD: '$', EUR: '€', GBP: '£', PEN: 'S/' };

function formatDashboardCurrency(amount: number, currency: string): string {
  return `${CURRENCY_SYMBOLS[currency] || currency}${amount.toFixed(2)}`;
}

function formatRate(r: number | null): string {
  return r === null ? '—' : `${r.toLocaleString('es-PE', { maximumFractionDigits: 1 })}%`;
}

// --- Sub-components ---

function RecentOrdersCard({ orders, timezone }: { orders: Order[]; timezone: string }) {
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
                      {formatDate(order.created_at, timezone)}
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

export function DashboardClient({ initialMetrics, recentOrders, topProducts, ordersByCity, initialConversionRate, conversationCount, noPurchaseReasons, adsSummary, startDate, endDate, defaultStartDate, defaultEndDate }: DashboardClientProps) {
  const router = useRouter();
  const timezone = useTenantTimezone();
  const [isPending, startTransition] = useTransition();
  const [fromDate, setFromDate] = useState<Date | undefined>(new Date(startDate + 'T00:00:00'));
  const [toDate, setToDate] = useState<Date | undefined>(new Date(endDate + 'T00:00:00'));

  const isModified =
    fromDate !== undefined &&
    toDate !== undefined &&
    (toLocalDateStr(fromDate) !== defaultStartDate ||
     toLocalDateStr(toDate) !== defaultEndDate);

  // "Hoy" según el tenant (computado por el servidor) — usado como límite superior en pickers
  const today = new Date(defaultEndDate + 'T00:00:00');

  const handleReset = () => {
    setFromDate(new Date(defaultStartDate + 'T00:00:00'));
    setToDate(new Date(defaultEndDate + 'T00:00:00'));
    startTransition(() => {
      router.push('/dashboard/get-started');
    });
  };

  const navigateWithDates = (from: Date | undefined, to: Date | undefined) => {
    if (from && to) {
      startTransition(() => {
        router.push(`/dashboard/get-started?start_date=${toLocalDateStr(from)}&end_date=${toLocalDateStr(to)}`);
      });
    }
  };

  const handleFromChange = (date: Date | undefined) => {
    setFromDate(date);
    if (date && toDate && date > toDate) {
      setToDate(undefined);
    } else {
      navigateWithDates(date, toDate);
    }
  };

  const handleToChange = (date: Date | undefined) => {
    setToDate(date);
    navigateWithDates(fromDate, date);
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
            Resumen de operación
            {fromDate && toDate && (
              <> · del {format(fromDate, "dd/MM/yyyy", { locale: es })} al {format(toDate, "dd/MM/yyyy", { locale: es })}</>
            )}
          </p>
        </div>

        <div className={cn("flex items-center gap-2", isPending && "opacity-60 pointer-events-none")}>
          <DatePicker
            date={fromDate}
            onDateChange={handleFromChange}
            label="Desde"
            placeholder="Inicio"
            toDate={today}
          />
          <span className="text-muted-foreground text-sm mt-4">—</span>
          <DatePicker
            date={toDate}
            onDateChange={handleToChange}
            label="Hasta"
            placeholder="Fin"
            toDate={today}
            fromDate={fromDate}
            disabled={fromDate ? { before: fromDate } : undefined}
          />
          <AnimatePresence>
            {isModified && (
              <motion.button
                key="reset"
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.6 }}
                transition={{ type: "spring", stiffness: 500, damping: 28 }}
                onClick={handleReset}
                aria-label="Restablecer fechas"
                className="group self-end flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground/50 transition-colors duration-200 hover:text-volt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-volt/50"
              >
                <RotateCcw className="h-4 w-4 transition-transform duration-500 group-hover:-rotate-180" />
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          {
            title: "Total Pedidos",
            value: initialMetrics.total_orders.toLocaleString('es-PE'),
            icon: <ShoppingBag className="w-5 h-5" />,
            comparison: `del ${formatDate(initialMetrics.start_date, timezone)} al ${formatDate(initialMetrics.end_date, timezone)}`,
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
            title: "Ventas (período seleccionado)",
            value: formatDashboardCurrency(initialMetrics.total_sales, initialMetrics.currency),
            icon: <DollarSign className="w-5 h-5" />,
            comparison: "solo órdenes validadas",
            accentColor: "success" as const,
          },
          {
            title: "Tasa de Conversión",
            value: formatRate(initialConversionRate.conversion_rate),
            icon: <TrendingUp className="w-5 h-5" />,
            accentColor: "aqua" as const,
            comparison: initialConversionRate.conversion_rate !== null
              ? `${initialConversionRate.conversions.toLocaleString('es-PE')} conv. de ${initialConversionRate.total_conversations.toLocaleString('es-PE')}`
              : undefined,
          },
          {
            title: "Conversaciones",
            value: conversationCount.toLocaleString('es-PE'),
            icon: <MessageSquare className="w-5 h-5" />,
            comparison: "iniciadas en el período",
            accentColor: "cielo" as const,
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
          <RecentOrdersCard orders={recentOrders} timezone={timezone} />
        </motion.div>
        <motion.div variants={fadeUp} className="flex">
          <TopProductsRanking products={topProducts} />
        </motion.div>
      </div>

      {/* No-purchase reasons + Ads summary */}
      <motion.div variants={fadeUp} className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <NoPurchaseReasonsRanking data={noPurchaseReasons} />
        <AdsSummaryWidget data={adsSummary} />
      </motion.div>

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

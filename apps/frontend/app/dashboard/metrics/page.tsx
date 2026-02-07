import { getAccessToken } from "@/lib/auth0";
import {
  fetchTopProducts,
  fetchOrdersByCity,
  fetchDashboardMetrics,
} from "@/lib/services/metrics-service";
import type { PeriodType } from "@/lib/services/metrics-service";
import { MetricsClient } from "./metrics-client";

export const dynamic = "force-dynamic";

const VALID_PERIODS = new Set<PeriodType>([
  "today",
  "yesterday",
  "last_7_days",
  "last_30_days",
  "this_month",
  "last_month",
]);

interface PageProps {
  searchParams: Promise<{ period?: string }>;
}

export default async function MetricsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const rawPeriod = params.period ?? "last_30_days";
  const period: PeriodType = VALID_PERIODS.has(rawPeriod as PeriodType)
    ? (rawPeriod as PeriodType)
    : "last_30_days";

  let topProductsData = null;
  let ordersByCityData = null;
  let dashboardData = null;
  let error: string | null = null;

  try {
    const accessToken = await getAccessToken();

    if (!accessToken) {
      throw new Error("No estás autenticado");
    }

    const [topProducts, ordersByCity, dashboard] = await Promise.all([
      fetchTopProducts(accessToken, { period }),
      fetchOrdersByCity(accessToken, { period }),
      fetchDashboardMetrics(accessToken, { period }),
    ]);

    topProductsData = topProducts;
    ordersByCityData = ordersByCity;
    dashboardData = dashboard;
  } catch (err) {
    console.error("Error loading metrics:", err);
    error = err instanceof Error ? err.message : "Error al cargar métricas";
  }

  if (error || !topProductsData || !ordersByCityData || !dashboardData) {
    return (
      <div className="space-y-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold">Métricas</h1>
          <p className="text-muted-foreground">
            Visualiza el rendimiento de tu negocio.
          </p>
        </div>
        <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-lg">
          <p className="font-semibold">Error al cargar métricas</p>
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <MetricsClient
      topProducts={topProductsData}
      ordersByCity={ordersByCityData}
      dashboardMetrics={dashboardData}
      initialPeriod={period}
    />
  );
}


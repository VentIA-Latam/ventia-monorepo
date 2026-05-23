import { getAccessToken } from "@/lib/auth0";
import {
  fetchDashboardMetrics,
  fetchTopProducts,
  fetchOrdersByCity,
  fetchConversionRate,
  fetchNoPurchaseReasons,
  fetchAdsSummary,
  ConversionRate,
  NoPurchaseReasonsResponse,
  AdsSummaryResponse,
} from "@/lib/services/metrics-service";
import { fetchOrders } from "@/lib/services/order-service";
import { getCurrentUser } from "@/lib/services/user-service";
import { DashboardClient } from "./dashboard-client";
import { AutoRefresh } from "./auto-refresh";
import { getDefaultDateRangeInTz } from "@/lib/utils";

interface DashboardPageProps {
  searchParams: Promise<{
    start_date?: string;
    end_date?: string;
  }>;
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const params = await searchParams;
  const accessToken = await getAccessToken();

  if (!accessToken) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Error de autenticación</h1>
        <p className="text-muted-foreground">
          No estás autenticado. Por favor, inicia sesión.
        </p>
      </div>
    );
  }

  const user = await getCurrentUser(accessToken);
  const timezone = user.tenant?.timezone || "America/Lima";
  const defaults = getDefaultDateRangeInTz(timezone, 7);
  const startDate = params.start_date || defaults.start;
  const endDate = params.end_date || defaults.end;

  let metrics;
  let recentOrders;
  let topProducts;
  let ordersByCity;
  let conversionRate: ConversionRate | undefined;
  let noPurchaseReasons: NoPurchaseReasonsResponse | undefined;
  let adsSummary: AdsSummaryResponse | undefined;
  let error: Error | null = null;

  const conversionRateFallback: ConversionRate = {
    conversion_rate: null, conversions: 0, total_conversations: 0,
    period: 'custom', start_date: startDate, end_date: endDate,
  };

  const query = { period: 'custom' as const, start_date: startDate, end_date: endDate };

  try {
    const [
      metricsRes,
      ordersRes,
      topProductsRes,
      ordersByCityRes,
      conversionRateRes,
      noPurchaseReasonsRes,
      adsSummaryRes,
    ] = await Promise.allSettled([
      fetchDashboardMetrics(accessToken, query),
      fetchOrders(accessToken, { limit: 5, skip: 0, sortBy: 'updated_at', sortOrder: 'desc' }),
      fetchTopProducts(accessToken, query),
      fetchOrdersByCity(accessToken, query),
      fetchConversionRate(accessToken, query),
      fetchNoPurchaseReasons(accessToken, query),
      fetchAdsSummary(accessToken, query),
    ]);

    if (metricsRes.status === 'rejected') throw metricsRes.reason;
    metrics = metricsRes.value;
    recentOrders = ordersRes.status === 'fulfilled' ? ordersRes.value : undefined;
    topProducts = topProductsRes.status === 'fulfilled' ? topProductsRes.value : undefined;
    ordersByCity = ordersByCityRes.status === 'fulfilled' ? ordersByCityRes.value : undefined;
    conversionRate = conversionRateRes.status === 'fulfilled' ? conversionRateRes.value : conversionRateFallback;
    noPurchaseReasons =
      noPurchaseReasonsRes.status === 'fulfilled' ? noPurchaseReasonsRes.value : undefined;
    adsSummary =
      adsSummaryRes.status === 'fulfilled' ? adsSummaryRes.value : undefined;

    if (conversionRateRes.status === 'rejected') {
      console.error('Error loading conversion rate:', conversionRateRes.reason);
    }

    if (noPurchaseReasonsRes.status === 'rejected') {
      console.error('Error loading no-purchase reasons:', noPurchaseReasonsRes.reason);
    }

    if (adsSummaryRes.status === 'rejected') {
      console.error('Error loading ads summary:', adsSummaryRes.reason);
    }
  } catch (err) {
    console.error('Error loading dashboard data:', err);
    error = err instanceof Error ? err : new Error('Error desconocido');
  }

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Error al cargar métricas</h1>
        <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-lg">
          <p className="font-semibold">No se pudieron cargar las métricas del dashboard</p>
          <p className="text-sm">{error.message}</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <AutoRefresh intervalMs={60000} />
      <DashboardClient
        initialMetrics={metrics!}
        recentOrders={recentOrders?.items || []}
        topProducts={topProducts?.data || []}
        ordersByCity={ordersByCity?.data || []}
        initialConversionRate={conversionRate!}
        noPurchaseReasons={noPurchaseReasons}
        adsSummary={adsSummary}
        startDate={startDate}
        endDate={endDate}
        defaultStartDate={defaults.start}
        defaultEndDate={defaults.end}
      />
    </>
  );
}

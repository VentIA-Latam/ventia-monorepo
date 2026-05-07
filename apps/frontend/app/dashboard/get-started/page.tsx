import { getAccessToken } from "@/lib/auth0";
import {
  fetchDashboardMetrics,
  fetchTopProducts,
  fetchOrdersByCity,
  fetchConversionRate,
  ConversionRate,
  PeriodType,
} from "@/lib/services/metrics-service";
import { fetchOrders } from "@/lib/services/order-service";
import { DashboardClient } from "./dashboard-client";
import { AutoRefresh } from "./auto-refresh";

interface DashboardPageProps {
  searchParams: Promise<{
    period?: string;
  }>;
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const params = await searchParams;
  const period = (params.period || 'today') as PeriodType;

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

  let metrics;
  let recentOrders;
  let topProducts;
  let ordersByCity;
  let conversionRate: ConversionRate | undefined;
  let error: Error | null = null;

  const conversionRateFallback: ConversionRate = {
    conversion_rate: null, conversions: 0, total_conversations: 0,
    period, start_date: '', end_date: '',
  };

  try {
    const [metricsRes, ordersRes, topProductsRes, ordersByCityRes, conversionRateRes] = await Promise.allSettled([
      fetchDashboardMetrics(accessToken, { period }),
      fetchOrders(accessToken, { limit: 5, skip: 0, sortBy: 'updated_at', sortOrder: 'desc' }),
      fetchTopProducts(accessToken, { period }),
      fetchOrdersByCity(accessToken, { period }),
      fetchConversionRate(accessToken, { period }),
    ]);

    if (metricsRes.status === 'rejected') throw metricsRes.reason;
    metrics = metricsRes.value;
    recentOrders = ordersRes.status === 'fulfilled' ? ordersRes.value : undefined;
    topProducts = topProductsRes.status === 'fulfilled' ? topProductsRes.value : undefined;
    ordersByCity = ordersByCityRes.status === 'fulfilled' ? ordersByCityRes.value : undefined;
    conversionRate = conversionRateRes.status === 'fulfilled' ? conversionRateRes.value : conversionRateFallback;

    if (conversionRateRes.status === 'rejected') {
      console.error('Error loading conversion rate:', conversionRateRes.reason);
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
      />
    </>
  );
}

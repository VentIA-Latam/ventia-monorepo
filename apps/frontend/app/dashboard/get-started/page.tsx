import { getAccessToken } from "@/lib/auth0";
import { fetchDashboardMetrics, PeriodType } from "@/lib/services/metrics-service";
import { fetchOrders } from "@/lib/services/order-service";
import { RecentActivityTable } from "@/components/dashboard/recent-activity-table";
import { DashboardClient } from "./dashboard-client";
import { AutoRefresh } from "./auto-refresh";

/**
 * 🔒 Server Component - Dashboard con métricas reales
 * 
 * Esta página:
 * 1. Se ejecuta en el servidor
 * 2. Obtiene el token de forma segura con getAccessToken()
 * 3. Carga métricas y actividad reciente desde el backend
 * 4. Pasa los datos al Client Component para interactividad
 */

interface DashboardPageProps {
  searchParams: Promise<{
    period?: string;
  }>;
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const params = await searchParams;
  const period = (params.period || 'today') as PeriodType;

  // 1️⃣ Obtener token de Auth0 (en el servidor)
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

  // 2️⃣ Fetch de métricas y actividad reciente (desde el servidor)
  let metrics;
  let recentOrders;
  let error: Error | null = null;

  try {
    // Fetch metrics and recent orders in parallel
    [metrics, recentOrders] = await Promise.all([
      fetchDashboardMetrics(accessToken, { period }),
      fetchOrders(accessToken, { limit: 10, skip: 0, sortBy: 'updated_at', sortOrder: 'desc' })
    ]);
  } catch (err) {
    console.error('Error loading dashboard data:', err);
    error = err instanceof Error ? err : new Error('Error desconocido');
  }

  // 3️⃣ Si hay error, mostrar mensaje
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

  // 4️⃣ Renderizar con datos reales
  return (
    <div className="space-y-6">
      {/* Auto-refresh cada 60 segundos (1 minuto) */}
      <AutoRefresh intervalMs={60000} />

      {/* Dashboard con métricas reales */}
      <DashboardClient initialMetrics={metrics!} />

      {/* Tabla de actividad reciente con datos del backend */}
      <RecentActivityTable orders={recentOrders?.items || []} />
    </div>
  );
}


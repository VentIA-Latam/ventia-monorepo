import { fetchStats, fetchRecentActivity, fetchTenants, fetchGlobalOrders } from "@/lib/services/superadmin-service";
import { SuperAdminDashboardClient } from "./superadmin-dashboard-client";

export default async function SuperAdminDashboard() {
  const [stats, tenantsData, globalOrders, activities] = await Promise.all([
    fetchStats(),
    fetchTenants({ limit: 10 }),
    fetchGlobalOrders(5),
    fetchRecentActivity(6),
  ]);

  return (
    <SuperAdminDashboardClient
      stats={stats}
      tenants={tenantsData.items}
      globalOrders={globalOrders}
      activities={activities}
    />
  );
}


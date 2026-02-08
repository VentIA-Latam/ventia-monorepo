import { fetchTenants, fetchOrdersFull } from "@/lib/services/superadmin-service";
import { SuperAdminOrdersClient } from "./superadmin-orders-client";

export const dynamic = "force-dynamic";

export default async function SuperAdminOrdersPage() {
  try {
    // async-parallel: fetch tenants and orders in parallel
    const [tenantsData, ordersData] = await Promise.all([
      fetchTenants({ limit: 100 }),
      fetchOrdersFull({ limit: 100 }),
    ]);

    // server-serialization: only pass {id, name} to client
    const tenantOptions = tenantsData.items.filter((t) => !t.is_platform).map((t) => ({
      id: t.id,
      name: t.name,
    }));

    return (
      <SuperAdminOrdersClient
        tenants={tenantOptions}
        initialOrders={ordersData.items}
      />
    );
  } catch (error) {
    console.error("Error loading superadmin orders:", error);
    return (
      <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-lg">
        <p className="font-semibold">Error al cargar pedidos</p>
        <p className="text-sm">
          {error instanceof Error ? error.message : "Error desconocido"}
        </p>
      </div>
    );
  }
}

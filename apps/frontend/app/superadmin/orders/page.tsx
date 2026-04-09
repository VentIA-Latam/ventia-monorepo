import { fetchOrdersFull } from "@/lib/services/superadmin-service";
import { SuperAdminOrdersClient } from "./superadmin-orders-client";

export const dynamic = "force-dynamic";

export default async function SuperAdminOrdersPage() {
  try {
    const ordersData = await fetchOrdersFull({ limit: 10 });

    return (
      <SuperAdminOrdersClient
        initialOrders={ordersData.items}
        initialTotal={ordersData.total ?? 0}
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

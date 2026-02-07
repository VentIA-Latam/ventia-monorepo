import { fetchOrders, Order } from "@/lib/services/order-service";
import { getAccessToken } from "@/lib/auth0";
import { OrdersClientView } from "./orders-client";

// Forzar renderizado dinámico (SSR) porque usa cookies para auth
export const dynamic = 'force-dynamic';

/**
 * Server Component - Carga de datos segura
 *
 * Esta página es un Server Component (sin "use client"), lo que significa:
 * 1. Se ejecuta SOLO en el servidor de Next.js
 * 2. Puede usar getAccessToken() directamente de Auth0
 * 3. El token NUNCA llega al navegador del usuario
 * 4. Hace el fetch al backend de forma segura
 * 5. Pasa los datos ya cargados al Client Component para la interactividad
 */

export default async function OrdersPage() {
  let orders: Order[] = [];
  let error: string | null = null;

  try {
    // 1. Obtener el token directamente desde Auth0 (en el servidor)
    const accessToken = await getAccessToken();

    if (!accessToken) {
      throw new Error('No estás autenticado');
    }

    // 2. Hacer el fetch al backend con el token (desde el servidor)
    const response = await fetchOrders(accessToken, {
      skip: 0,
      limit: 100,
    });

    // 3. Usar datos del backend directamente (sin transformación innecesaria)
    orders = response.items;

  } catch (err) {
    console.error('Error loading orders:', err);
    error = err instanceof Error ? err.message : 'Error al cargar órdenes';
  }

  // Si hay un error, mostramos un mensaje
  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold">Listado de Pedidos</h1>
          <p className="text-muted-foreground mt-1">
            Gestiona y monitorea todas las órdenes, estados de pago y logística centralizada.
          </p>
        </div>
        <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-lg">
          <p className="font-semibold">Error al cargar órdenes</p>
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  // 4️⃣ Pasar las órdenes al Client Component para manejar la interactividad
  return <OrdersClientView initialOrders={orders} />;
}

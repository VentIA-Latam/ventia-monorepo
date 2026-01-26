import { Order as UIOrder } from "@/lib/types/order";
import { fetchOrders, Order as BackendOrder } from "@/lib/services/order-service";
import { getAccessToken } from "@/lib/auth0";
import { OrdersClientView } from "./orders-client";
import { formatDate, getEcommerceOrderId, extractShopifyOrderId } from "@/lib/utils";

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

// Convert currency code to symbol
function getCurrencySymbol(currency: string): string {
  const symbols: Record<string, string> = {
    'USD': '$',
    'EUR': '€',
    'GBP': '£',
    'PEN': 'S/',
    'MXN': '$',
    'ARS': '$',
    'CLP': '$',
  };
  return symbols[currency.toUpperCase()] || currency;
}

// Map backend order to UI order format
function mapBackendOrderToUI(backendOrder: BackendOrder): UIOrder {
  return {
    id: getEcommerceOrderId({
      shopify_draft_order_id: backendOrder.shopify_draft_order_id,
      woocommerce_order_id: backendOrder.woocommerce_order_id
    }),
    dbId: backendOrder.id, // ID real de la base de datos
    shopifyOrderId: backendOrder.shopify_order_id
      ? extractShopifyOrderId(backendOrder.shopify_order_id)
      : null,
    date: formatDate(backendOrder.created_at),
    client: {
      name: backendOrder.customer_name || 'Sin nombre',
      email: backendOrder.customer_email,
    },
    channel: 'Portal B2B',
    paymentStatus: backendOrder.status as 'Pagado' | 'Pendiente' | 'Rechazado',
    logisticsStatus: 'Procesando',
    amount: backendOrder.total_price,
    currency: getCurrencySymbol(backendOrder.currency),
  };
}

export default async function OrdersPage() {
  // Usamos getAccessToken() directamente desde el servidor

  let orders: UIOrder[] = [];
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

    // 3. Mapear las órdenes al formato de UI
    orders = response.items.map(mapBackendOrderToUI);

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
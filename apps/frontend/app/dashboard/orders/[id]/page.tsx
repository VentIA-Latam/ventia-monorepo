import { getAccessToken } from "@/lib/auth0";
import { fetchOrder } from "@/lib/services/order-service";
import { fetchInvoicesByOrder } from "@/lib/services/invoice-service";
import { OrderDetail } from "@/components/dashboard/orders/order-detail";
import { notFound } from "next/navigation";
import { Invoice } from "@/lib/types/invoice";

/**
 * 🔒 Server Component - Página de detalle de orden
 * 
 * Esta página:
 * 1. Se ejecuta en el servidor
 * 2. Obtiene el token de forma segura con getAccessToken()
 * 3. Carga los datos de la orden específica
 * 4. Carga los invoices de la orden
 * 5. Pasa los datos al Client Component para interactividad
 */

interface OrderPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function OrderPage({ params }: OrderPageProps) {
  const { id } = await params;
  const orderId = parseInt(id);

  // Validar que el ID sea un número válido
  if (isNaN(orderId)) {
    notFound();
  }

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

  // 2️⃣ Fetch orden e invoices en paralelo (async-parallel)
  const [orderResult, invoicesResult] = await Promise.allSettled([
    fetchOrder(accessToken, orderId),
    fetchInvoicesByOrder(accessToken, orderId),
  ]);

  // 3️⃣ Si hay error en la orden, mostrar mensaje
  if (orderResult.status === 'rejected') {
    const error = orderResult.reason instanceof Error
      ? orderResult.reason
      : new Error('Error desconocido');
    console.error('Error loading order:', error);
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Error al cargar pedido</h1>
        <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-lg">
          <p className="font-semibold">No se pudo cargar el pedido</p>
          <p className="text-sm">{error.message}</p>
        </div>
      </div>
    );
  }

  const order = orderResult.value;
  // Invoices no son críticos, usar array vacío si fallan
  const invoices: Invoice[] = invoicesResult.status === 'fulfilled'
    ? invoicesResult.value
    : [];

  // 5️⃣ Renderizar el componente cliente con los datos
  return <OrderDetail order={order!} invoices={invoices} />;
}

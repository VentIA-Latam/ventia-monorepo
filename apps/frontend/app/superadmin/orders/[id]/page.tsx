import { getAccessToken } from "@/lib/auth0";
import { fetchOrder } from "@/lib/services/order-service";
import { fetchInvoicesByOrder } from "@/lib/services/invoice-service";
import { OrderDetail } from "@/components/dashboard/orders/order-detail";
import { notFound } from "next/navigation";
import type { Invoice } from "@/lib/types/invoice";

interface OrderPageProps {
  params: Promise<{ id: string }>;
}

export default async function SuperAdminOrderPage({ params }: OrderPageProps) {
  const { id } = await params;
  const orderId = parseInt(id);

  if (isNaN(orderId)) {
    notFound();
  }

  const accessToken = await getAccessToken();

  if (!accessToken) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Error de autenticación</h1>
        <p className="text-muted-foreground">No estás autenticado.</p>
      </div>
    );
  }

  // async-parallel
  const [orderResult, invoicesResult] = await Promise.allSettled([
    fetchOrder(accessToken, orderId),
    fetchInvoicesByOrder(accessToken, orderId),
  ]);

  if (orderResult.status === "rejected") {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Error al cargar pedido</h1>
        <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-lg">
          <p className="text-sm">{orderResult.reason?.message || "Error desconocido"}</p>
        </div>
      </div>
    );
  }

  const order = orderResult.value;
  const invoices: Invoice[] =
    invoicesResult.status === "fulfilled" ? invoicesResult.value : [];

  return <OrderDetail order={order!} invoices={invoices} basePath="/superadmin" />;
}

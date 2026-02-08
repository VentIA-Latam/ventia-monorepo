import { getAccessToken } from "@/lib/auth0";
import { fetchOrder } from "@/lib/services/order-service";
import { fetchInvoicesByOrder } from "@/lib/services/invoice-service";
import { notFound, redirect } from "next/navigation";
import type { Invoice } from "@/lib/types/invoice";
import { ArrowLeft, AlertCircle } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { NewInvoiceForm } from "@/app/dashboard/invoices/new/new-invoice-form";

interface NewInvoicePageProps {
  searchParams: Promise<{ orderId?: string }>;
}

export default async function SuperAdminNewInvoicePage({ searchParams }: NewInvoicePageProps) {
  const params = await searchParams;
  const orderIdParam = params.orderId;

  if (!orderIdParam) {
    redirect("/superadmin/orders");
  }

  const orderId = parseInt(orderIdParam);
  if (isNaN(orderId)) {
    notFound();
  }

  const accessToken = await getAccessToken();
  if (!accessToken) {
    return (
      <div className="space-y-6">
        <Link href="/superadmin/orders">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver a Órdenes
          </Button>
        </Link>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error de autenticación</AlertTitle>
          <AlertDescription>No estás autenticado.</AlertDescription>
        </Alert>
      </div>
    );
  }

  // async-parallel
  const [orderResult, invoicesResult] = await Promise.allSettled([
    fetchOrder(accessToken, orderId),
    fetchInvoicesByOrder(accessToken, orderId),
  ]);

  if (orderResult.status === "rejected" || !orderResult.value) {
    return (
      <div className="space-y-6">
        <Link href="/superadmin/orders">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver a Órdenes
          </Button>
        </Link>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>No se pudo cargar la orden</AlertTitle>
          <AlertDescription>
            {orderResult.status === "rejected"
              ? orderResult.reason?.message || "Error desconocido"
              : "Orden no encontrada"}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const order = orderResult.value;

  // Validate order requirements
  if (!order.validado) {
    return (
      <div className="space-y-6">
        <Link href={`/superadmin/orders/${orderId}`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver a la Orden
          </Button>
        </Link>
        <h1 className="text-3xl font-bold">No se puede crear comprobante</h1>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Requisitos no cumplidos</AlertTitle>
          <AlertDescription>
            La orden debe estar validada antes de generar un comprobante.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const existingInvoices: Invoice[] =
    invoicesResult.status === "fulfilled" ? invoicesResult.value : [];

  return <NewInvoiceForm order={order} existingInvoices={existingInvoices} basePath="/superadmin" />;
}

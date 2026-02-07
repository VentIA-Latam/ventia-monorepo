import { getAccessToken } from "@/lib/auth0";
import { fetchOrder } from "@/lib/services/order-service";
import { fetchInvoicesByOrder } from "@/lib/services/invoice-service";
import { notFound, redirect } from "next/navigation";
import type { Invoice } from "@/lib/types/invoice";
import { ArrowLeft, AlertCircle } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { NewInvoiceForm } from "./new-invoice-form";

/**
 * 🔒 Server Component - Página de creación de comprobante
 * 
 * Esta página:
 * 1. Obtiene orderId de searchParams
 * 2. Carga la orden y valida requisitos
 * 3. Carga invoices previos si es NC/ND
 * 4. Pasa datos al Client Component
 */

interface NewInvoicePageProps {
  searchParams: Promise<{ orderId?: string }>;
}

export default async function NewInvoicePage({ searchParams }: NewInvoicePageProps) {
  const params = await searchParams;
  const orderIdParam = params.orderId;

  // 1️⃣ Validar que existe orderId
  if (!orderIdParam) {
    redirect("/dashboard/orders");
  }

  const orderId = parseInt(orderIdParam);
  if (isNaN(orderId)) {
    notFound();
  }

  // 2️⃣ Obtener token
  const accessToken = await getAccessToken();
  if (!accessToken) {
    return (
      <div className="space-y-6">
        <Link href="/dashboard/orders">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver a Órdenes
          </Button>
        </Link>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error de autenticación</AlertTitle>
          <AlertDescription>No estás autenticado. Por favor, inicia sesión.</AlertDescription>
        </Alert>
      </div>
    );
  }

  // 3️⃣ Cargar orden e invoices en paralelo (async-parallel)
  const [orderResult, invoicesResult] = await Promise.allSettled([
    fetchOrder(accessToken, orderId),
    fetchInvoicesByOrder(accessToken, orderId),
  ]);

  if (orderResult.status === 'rejected' || !orderResult.value) {
    const error = orderResult.status === 'rejected'
      ? (orderResult.reason instanceof Error ? orderResult.reason : new Error("Error desconocido"))
      : new Error("Orden no encontrada");
    console.error("Error loading order:", error);
    return (
      <div className="space-y-6">
        <Link href="/dashboard/orders">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver a Órdenes
          </Button>
        </Link>
        <h1 className="text-3xl font-bold">Error al cargar orden</h1>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>No se pudo cargar la orden</AlertTitle>
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      </div>
    );
  }

  const order = orderResult.value;

  // 4️⃣ Validar requisitos de la orden
  const validationErrors: string[] = [];

  if (!order.validado) {
    validationErrors.push("La orden debe estar validada antes de generar un comprobante");
  }

  if (validationErrors.length > 0) {
    return (
      <div className="space-y-6">
        <Link href={`/dashboard/orders/${orderId}`}>
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
            <ul className="list-disc list-inside space-y-1 mt-2">
              {validationErrors.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
        <Link href={`/dashboard/orders/${orderId}`}>
          <Button>Volver a la orden para completar requisitos</Button>
        </Link>
      </div>
    );
  }

  // 5️⃣ Invoices previos (ya cargados en paralelo, para NC/ND)
  const existingInvoices: Invoice[] = invoicesResult.status === 'fulfilled'
    ? invoicesResult.value
    : [];

  // 6️⃣ Renderizar formulario
  return <NewInvoiceForm order={order} existingInvoices={existingInvoices} />;
}


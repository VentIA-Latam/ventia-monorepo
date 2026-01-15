import { getAccessToken } from "@/lib/auth0";
import { fetchInvoice } from "@/lib/services/invoice-service";
import { InvoiceDetailClient } from "./invoice-detail-client";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

/**
 * 🔒 Server Component - Página de detalle de comprobante
 * 
 * Esta página:
 * 1. Se ejecuta en el servidor
 * 2. Obtiene el token de forma segura con getAccessToken()
 * 3. Carga los datos del comprobante específico usando fetchInvoice
 * 4. Pasa los datos al Client Component para interactividad
 */

interface InvoicePageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function InvoicePage({ params }: InvoicePageProps) {
  const { id } = await params;
  const invoiceId = parseInt(id);

  // Validar que el ID sea un número válido
  if (isNaN(invoiceId)) {
    notFound();
  }

  // 1️⃣ Obtener token de Auth0 (en el servidor)
  const accessToken = await getAccessToken();

  if (!accessToken) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Link href="/dashboard/invoices">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver
            </Button>
          </Link>
        </div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <FileText className="h-8 w-8" />
          Error de autenticación
        </h1>
        <p className="text-muted-foreground">
          No estás autenticado. Por favor, inicia sesión.
        </p>
      </div>
    );
  }

  // 2️⃣ Fetch del comprobante específico (desde el servidor)
  let invoice;
  let error: Error | null = null;

  try {
    invoice = await fetchInvoice(accessToken, invoiceId);
  } catch (err) {
    console.error('Error loading invoice:', err);
    error = err instanceof Error ? err : new Error('Error desconocido');
  }

  // 3️⃣ Si hay error, mostrar mensaje
  if (error || !invoice) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Link href="/dashboard/invoices">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver a Facturación
            </Button>
          </Link>
        </div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <FileText className="h-8 w-8" />
          Error al cargar comprobante
        </h1>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>No se pudo cargar el comprobante</AlertTitle>
          <AlertDescription>
            {error?.message || 'Comprobante no encontrado'}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // 4️⃣ Renderizar el componente cliente con los datos
  return <InvoiceDetailClient invoice={invoice} />;
}

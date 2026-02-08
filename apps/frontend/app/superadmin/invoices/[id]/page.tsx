import { getAccessToken } from "@/lib/auth0";
import { fetchInvoice } from "@/lib/services/invoice-service";
import { InvoiceDetailClient } from "@/app/dashboard/invoices/[id]/invoice-detail-client";
import { notFound } from "next/navigation";

interface InvoicePageProps {
  params: Promise<{ id: string }>;
}

export default async function SuperAdminInvoicePage({ params }: InvoicePageProps) {
  const { id } = await params;
  const invoiceId = parseInt(id);

  if (isNaN(invoiceId)) {
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

  let invoice;
  try {
    invoice = await fetchInvoice(accessToken, invoiceId);
  } catch (err) {
    console.error("Error loading invoice:", err);
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Error al cargar comprobante</h1>
        <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-lg">
          <p className="text-sm">
            {err instanceof Error ? err.message : "Error desconocido"}
          </p>
        </div>
      </div>
    );
  }

  if (!invoice) {
    notFound();
  }

  return <InvoiceDetailClient invoice={invoice} basePath="/superadmin" />;
}

import { fetchInvoicesFull } from "@/lib/services/superadmin-service";
import { SuperAdminInvoicesClient } from "./superadmin-invoices-client";

export const dynamic = "force-dynamic";

export default async function SuperAdminInvoicesPage() {
  try {
    const invoicesData = await fetchInvoicesFull({ limit: 10 });

    return (
      <SuperAdminInvoicesClient
        initialInvoices={invoicesData.items}
        initialTotal={invoicesData.total ?? 0}
      />
    );
  } catch (error) {
    console.error("Error loading superadmin invoices:", error);
    return (
      <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-lg">
        <p className="font-semibold">Error al cargar comprobantes</p>
        <p className="text-sm">
          {error instanceof Error ? error.message : "Error desconocido"}
        </p>
      </div>
    );
  }
}

import { fetchTenants, fetchInvoicesFull } from "@/lib/services/superadmin-service";
import { SuperAdminInvoicesClient } from "./superadmin-invoices-client";

export const dynamic = "force-dynamic";

export default async function SuperAdminInvoicesPage() {
  try {
    // async-parallel: fetch tenants and invoices in parallel
    const [tenantsData, invoicesData] = await Promise.all([
      fetchTenants({ limit: 100 }),
      fetchInvoicesFull({ limit: 100 }),
    ]);

    // server-serialization: only pass {id, name} to client
    const tenantOptions = tenantsData.items.filter((t) => !t.is_platform).map((t) => ({
      id: t.id,
      name: t.name,
    }));

    return (
      <SuperAdminInvoicesClient
        tenants={tenantOptions}
        initialInvoices={invoicesData.items}
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

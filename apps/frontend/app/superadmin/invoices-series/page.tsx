import { fetchInvoiceSeries } from "@/lib/services/superadmin-service";
import { InvoiceSeriesClientView } from "./series-client";

export const dynamic = 'force-dynamic';

export default async function InvoiceSeriesPage() {
  try {
    const data = await fetchInvoiceSeries({ limit: 10 });

    return (
      <InvoiceSeriesClientView
        initialSeries={data.items}
        initialTotal={data.total ?? 0}
      />
    );
  } catch (error) {
    console.error("Error loading invoice series:", error);
    return (
      <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-lg">
        <p className="font-semibold">Error al cargar series de facturación</p>
        <p className="text-sm">
          {error instanceof Error ? error.message : "Error desconocido"}
        </p>
      </div>
    );
  }
}

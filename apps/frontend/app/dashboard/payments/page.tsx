import { fetchPaymentRecords } from "@/lib/services/payment-service"
import { PaymentsTable } from "@/components/dashboard/payments/payments-table"

export default async function PaymentsPage() {
  let records;
  try {
    records = await fetchPaymentRecords();
  } catch (err) {
    console.error("Error loading payments:", err);
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Pagos</h1>
        <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-lg">
          <p className="font-semibold">Error al cargar pagos</p>
          <p className="text-sm">{err instanceof Error ? err.message : "Error desconocido"}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Pagos</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Revisa el detalle de los pedidos registrados y su estado de validación.
      </p>
      <PaymentsTable records={records} />
    </div>
  )
}


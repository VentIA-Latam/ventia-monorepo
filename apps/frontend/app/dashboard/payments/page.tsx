import { fetchPaymentRecords } from "@/lib/services/payment-service"
import { PaymentsTable } from "@/components/dashboard/payments-table"

export default async function PaymentsPage() {
  const records = await fetchPaymentRecords()

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Pagos</h1>
      <p className="text-sm text-slate-500 mb-6">
        Revisa el detalle de los pedidos registrados y su estado de validación.
      </p>
      <PaymentsTable records={records} />
    </div>
  )
}

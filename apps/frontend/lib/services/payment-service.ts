import { PaymentRecord } from "@/lib/types/payment-record"
import { mockPayments } from "@/lib/mock-data"

export async function fetchPaymentRecords(): Promise<PaymentRecord[]> {
  // Retornar datos mock directamente
  // Cuando tengas una API real, reemplaza esto con fetch
  return mockPayments
}

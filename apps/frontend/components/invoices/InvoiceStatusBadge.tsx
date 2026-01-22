import { Badge } from "@/components/ui/badge";
import { INVOICE_STATUS_NAMES } from "@/lib/types/invoice";

interface InvoiceStatusBadgeProps {
  status: "pending" | "processing" | "success" | "error";
}

/**
 * US-008: Badge reutilizable para estados de invoice
 * 
 * Muestra el estado con colores consistentes:
 * - pending: Gris
 * - processing: Amarillo
 * - success: Verde
 * - error: Rojo
 */
export function InvoiceStatusBadge({ status }: InvoiceStatusBadgeProps) {
  const variantMap = {
    pending: "secondary",
    processing: "secondary",
    success: "default",
    error: "destructive",
  } as const;

  const colorMap = {
    pending: "bg-gray-100 text-gray-700 hover:bg-gray-100",
    processing: "bg-yellow-100 text-yellow-700 hover:bg-yellow-100",
    success: "bg-green-100 text-green-700 hover:bg-green-100",
    error: "bg-red-100 text-red-700 hover:bg-red-100",
  };

  return (
    <Badge
      variant={variantMap[status]}
      className={colorMap[status]}
    >
      {INVOICE_STATUS_NAMES[status]}
    </Badge>
  );
}

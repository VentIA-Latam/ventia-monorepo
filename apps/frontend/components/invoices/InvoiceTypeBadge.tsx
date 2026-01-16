import { Badge } from "@/components/ui/badge";
import { INVOICE_TYPE_NAMES } from "@/lib/types/invoice";

interface InvoiceTypeBadgeProps {
  type: "01" | "03" | "07" | "08";
}

/**
 * US-008: Badge reutilizable para tipos de invoice
 * 
 * Muestra el tipo con colores consistentes:
 * - "01" (Factura): Azul
 * - "03" (Boleta): Verde
 * - "07" (NC): Naranja
 * - "08" (ND): Morado
 */
export function InvoiceTypeBadge({ type }: InvoiceTypeBadgeProps) {
  const colorMap = {
    "01": "bg-blue-100 text-blue-700 hover:bg-blue-100",
    "03": "bg-green-100 text-green-700 hover:bg-green-100",
    "07": "bg-orange-100 text-orange-700 hover:bg-orange-100",
    "08": "bg-purple-100 text-purple-700 hover:bg-purple-100",
  };

  return (
    <Badge
      variant="secondary"
      className={colorMap[type]}
    >
      {INVOICE_TYPE_NAMES[type]}
    </Badge>
  );
}

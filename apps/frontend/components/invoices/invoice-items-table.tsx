"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Invoice } from "@/lib/types/invoice";

interface InvoiceItemsTableProps {
  invoice: Invoice;
  formatCurrency: (amount: number | undefined, currency: string) => string;
}

export function InvoiceItemsTable({ invoice, formatCurrency }: InvoiceItemsTableProps) {
  if (!invoice.items || invoice.items.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Detalle de Items</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {invoice.items.map((item: any, index) => (
            <div key={index} className="flex justify-between items-start pb-3 border-b last:border-b-0">
              <div className="flex-1">
                <p className="font-medium">{item.product || item.descripcion || '-'}</p>
                <p className="text-sm text-muted-foreground">
                  SKU: {item.sku || '-'} • Cantidad: {item.quantity || item.cantidad || 0} x {formatCurrency(item.unitPrice || item.precio_unitario, invoice.currency)}
                </p>
              </div>
              <div className="text-right">
                <p className="font-semibold">{formatCurrency(item.subtotal || item.total, invoice.currency)}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Invoice } from "@/lib/types/invoice";

interface InvoiceBreakdownProps {
  invoice: Invoice;
  formatCurrency: (amount: number | undefined, currency: string) => string;
}

export function InvoiceBreakdown({ invoice, formatCurrency }: InvoiceBreakdownProps) {
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Desglose de Montos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between text-base">
            <span className="text-muted-foreground">Subtotal (Op. Gravada)</span>
            <span className="font-medium">{formatCurrency(invoice.subtotal, invoice.currency)}</span>
          </div>
          <div className="flex justify-between text-base">
            <span className="text-muted-foreground">IGV (18%)</span>
            <span className="font-medium">{formatCurrency(invoice.igv, invoice.currency)}</span>
          </div>
          <Separator />
          <div className="flex justify-between text-lg">
            <span className="font-semibold">Total</span>
            <span className="font-bold text-primary">{formatCurrency(invoice.total, invoice.currency)}</span>
          </div>
        </CardContent>
      </Card>

      {/* Referencia (para NC/ND) */}
      {invoice.reference_invoice_id && (
        <Card>
          <CardHeader>
            <CardTitle>Comprobante Referenciado</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Comprobante Referencia</p>
              <p className="text-base font-mono mt-1">
                {invoice.reference_serie}-{String(invoice.reference_correlativo).padStart(8, '0')}
              </p>
            </div>
            {invoice.reference_reason && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Motivo</p>
                <p className="text-base mt-1">{invoice.reference_reason}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </>
  );
}

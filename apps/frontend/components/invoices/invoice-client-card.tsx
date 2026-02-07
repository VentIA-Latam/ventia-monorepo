"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Invoice } from "@/lib/types/invoice";

interface InvoiceClientCardProps {
  invoice: Invoice;
}

export function InvoiceClientCard({ invoice }: InvoiceClientCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Información del Cliente</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Nombre / Razón Social</p>
          <p className="text-base font-semibold mt-1">{invoice.cliente_razon_social}</p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Tipo de Documento</p>
            <p className="text-base mt-1">{invoice.cliente_tipo_documento}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Número de Documento</p>
            <p className="text-base font-mono mt-1">{invoice.cliente_numero_documento}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

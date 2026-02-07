"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Invoice } from "@/lib/types/invoice";

interface InvoiceEmissorCardProps {
  invoice: Invoice;
}

export function InvoiceEmissorCard({ invoice }: InvoiceEmissorCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Emisor</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Razón Social</p>
          <p className="text-base font-semibold mt-1">{invoice.emisor_razon_social}</p>
        </div>
        <div>
          <p className="text-sm font-medium text-muted-foreground">RUC</p>
          <p className="text-base font-mono mt-1">{invoice.emisor_ruc}</p>
        </div>
      </CardContent>
    </Card>
  );
}

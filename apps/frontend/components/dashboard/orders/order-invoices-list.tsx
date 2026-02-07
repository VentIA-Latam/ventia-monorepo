"use client";

import { useRouter } from "next/navigation";
import type { Order } from "@/lib/services/order-service";
import type { Invoice } from "@/lib/types/invoice";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText } from "lucide-react";

interface OrderInvoicesListProps {
  order: Order;
  invoices: Invoice[];
}

export function OrderInvoicesList({ order, invoices }: OrderInvoicesListProps) {
  const router = useRouter();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
          <FileText className="w-4 h-4 sm:w-5 sm:h-5" />
          Comprobantes Emitidos
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {invoices.length === 0 ? (
          <div className="text-center py-6 space-y-3">
            <p className="text-sm text-muted-foreground">
              No se han emitido comprobantes para esta orden
            </p>
            {order.validado && (
              <Button
                onClick={() => router.push(`/dashboard/invoices/new?orderId=${order.id}`)}
                className="gap-2"
              >
                <FileText className="h-4 w-4" />
                Emitir Comprobante
              </Button>
            )}
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {invoices.map((invoice) => (
                <div
                  key={invoice.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm">
                        {invoice.serie}-{String(invoice.correlativo).padStart(8, "0")}
                      </p>
                      <Badge
                        variant={
                          invoice.efact_status === "success" ? "default" :
                            invoice.efact_status === "processing" ? "secondary" : "destructive"
                        }
                        className="text-xs"
                      >
                        {invoice.efact_status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>
                        {invoice.invoice_type === "01" ? "Factura" :
                          invoice.invoice_type === "03" ? "Boleta" :
                            invoice.invoice_type === "07" ? "Nota de Crédito" : "Nota de Débito"}
                      </span>
                      <span>•</span>
                      <span>S/ {invoice.total.toFixed(2)}</span>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push(`/dashboard/invoices/${invoice.id}`)}
                  >
                    Ver Detalle
                  </Button>
                </div>
              ))}
            </div>
            {order.validado && (
              <Button
                onClick={() => router.push(`/dashboard/invoices/new?orderId=${order.id}`)}
                variant="outline"
                className="w-full gap-2"
              >
                <FileText className="h-4 w-4" />
                Emitir Nuevo Comprobante
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

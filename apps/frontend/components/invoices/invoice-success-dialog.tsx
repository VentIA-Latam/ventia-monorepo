"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CheckCircle2, FileText, Download } from "lucide-react";
import { Invoice } from "@/lib/types/invoice";

interface InvoiceSuccessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: Invoice | null;
  onViewInvoice?: () => void;
  onDownloadPdf?: () => void;
}

export function InvoiceSuccessDialog({
  open,
  onOpenChange,
  invoice,
  onViewInvoice,
  onDownloadPdf,
}: InvoiceSuccessDialogProps) {
  if (!invoice) return null;

  const invoiceTypeName = invoice.invoice_type === "01" ? "Factura" : "Boleta";
  const fullNumber = `${invoice.serie}-${String(invoice.correlativo).padStart(8, "0")}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <div className="flex flex-col items-center space-y-4 py-4">
            <div className="rounded-full bg-green-100 dark:bg-green-900/20 p-3">
              <CheckCircle2 className="h-12 w-12 text-green-600 dark:text-green-500" />
            </div>
            <DialogTitle className="text-2xl font-bold text-center">
              ¡{invoiceTypeName} Emitida Correctamente!
            </DialogTitle>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="rounded-lg border bg-muted/50 p-4 text-center space-y-2">
            <p className="text-sm text-muted-foreground">Número de Comprobante</p>
            <p className="text-2xl font-bold text-primary">{fullNumber}</p>
          </div>

          <div className="space-y-2 text-sm text-center text-muted-foreground">
            <p>El comprobante electrónico ha sido generado exitosamente.</p>
            {invoice.sunat_status === "accepted" && (
              <p className="text-green-600 dark:text-green-500 font-medium">
                ✓ Aceptado por SUNAT
              </p>
            )}
            {invoice.sunat_status === "pending" && (
              <p className="text-yellow-600 dark:text-yellow-500 font-medium">
                ⏳ Pendiente de envío a SUNAT
              </p>
            )}
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={onViewInvoice}
            className="w-full sm:w-auto"
          >
            <FileText className="mr-2 h-4 w-4" />
            Ver Comprobante
          </Button>
          <Button
            onClick={onDownloadPdf}
            className="w-full sm:w-auto"
          >
            <Download className="mr-2 h-4 w-4" />
            Descargar PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

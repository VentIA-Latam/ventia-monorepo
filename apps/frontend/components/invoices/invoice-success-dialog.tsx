"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CheckCircle2, FileText, Download, AlertCircle, Clock } from "lucide-react";
import { Invoice } from "@/lib/types/invoice";
import { Alert, AlertDescription } from "@/components/ui/alert";

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

  const invoiceTypeName =
    invoice.invoice_type === "01" ? "Factura" :
      invoice.invoice_type === "03" ? "Boleta" :
        invoice.invoice_type === "07" ? "Nota de Crédito" : "Nota de Débito";

  const fullNumber = `${invoice.serie}-${String(invoice.correlativo).padStart(8, "0")}`;

  const isSuccess = invoice.efact_status === "success";
  const isProcessing = invoice.efact_status === "processing";
  const isError = invoice.efact_status === "error";

  const documentTypeName =
    invoice.cliente_tipo_documento === "1" ? "DNI" :
      invoice.cliente_tipo_documento === "6" ? "RUC" :
        invoice.cliente_tipo_documento === "0" ? "Sin documento" :
          invoice.cliente_tipo_documento === "4" ? "Carnet Extranjería" :
            invoice.cliente_tipo_documento === "7" ? "Pasaporte" : "Documento";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex flex-col items-center space-y-3 sm:space-y-4 py-2 sm:py-4">
            <div className={`rounded-full p-2 sm:p-3 ${isSuccess ? "bg-green-100 dark:bg-green-900/20" :
                isError ? "bg-red-100 dark:bg-red-900/20" :
                  "bg-yellow-100 dark:bg-yellow-900/20"
              }`}>
              {isSuccess && <CheckCircle2 className="h-8 w-8 sm:h-12 sm:w-12 text-green-600 dark:text-green-500" />}
              {isError && <AlertCircle className="h-8 w-8 sm:h-12 sm:w-12 text-red-600 dark:text-red-500" />}
              {isProcessing && <Clock className="h-8 w-8 sm:h-12 sm:w-12 text-yellow-600 dark:text-yellow-500" />}
            </div>
            <DialogTitle className="text-lg sm:text-2xl font-bold text-center">
              {isSuccess && `¡${invoiceTypeName} Validada por SUNAT!`}
              {isError && `Error en Validación de ${invoiceTypeName}`}
              {isProcessing && `${invoiceTypeName} en Proceso`}
            </DialogTitle>
          </div>
        </DialogHeader>

        <div className="space-y-3 sm:space-y-4 py-2">
          {/* Número de Comprobante */}
          <div className="rounded-lg border bg-muted/50 p-3 sm:p-4 text-center space-y-1 sm:space-y-2">
            <p className="text-xs sm:text-sm text-muted-foreground">Número de Comprobante</p>
            <p className="text-xl sm:text-2xl font-bold text-primary">{fullNumber}</p>
          </div>

          {/* Datos del Comprobante */}
          <div className="space-y-2 sm:space-y-3 text-xs sm:text-sm border rounded-lg p-3 sm:p-4">
            <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
              <span className="text-muted-foreground">Tipo:</span>
              <span className="font-medium">{invoiceTypeName}</span>
            </div>
            <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
              <span className="text-muted-foreground">Emisor:</span>
              <span className="font-medium break-words">{invoice.emisor_razon_social}</span>
            </div>
            <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
              <span className="text-muted-foreground">RUC Emisor:</span>
              <span className="font-medium">{invoice.emisor_ruc}</span>
            </div>
            <div className="border-t pt-2 mt-2"></div>
            <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
              <span className="text-muted-foreground">Cliente:</span>
              <span className="font-medium break-words">{invoice.cliente_razon_social}</span>
            </div>
            <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
              <span className="text-muted-foreground">{documentTypeName}:</span>
              <span className="font-medium">{invoice.cliente_numero_documento}</span>
            </div>
            {invoice.cliente_email && (
              <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                <span className="text-muted-foreground">Email:</span>
                <span className="font-medium break-all">{invoice.cliente_email}</span>
              </div>
            )}
            <div className="border-t pt-2 mt-2"></div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal:</span>
              <span className="font-medium">{invoice.currency} {invoice.subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">IGV (18%):</span>
              <span className="font-medium">{invoice.currency} {invoice.igv.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-bold text-sm sm:text-base">
              <span>Total:</span>
              <span className="text-primary">{invoice.currency} {invoice.total.toFixed(2)}</span>
            </div>
          </div>

          {/* Estado de Validación */}
          {isSuccess && (
            <Alert className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 py-2 sm:py-3">
              <CheckCircle2 className="h-3 w-3 sm:h-4 sm:w-4 text-green-600" />
              <AlertDescription className="text-green-700 dark:text-green-400 text-xs sm:text-sm">
                ✓ Comprobante aceptado y validado por SUNAT
              </AlertDescription>
            </Alert>
          )}

          {isError && (
            <Alert variant="destructive" className="py-2 sm:py-3">
              <AlertCircle className="h-3 w-3 sm:h-4 sm:w-4" />
              <AlertDescription className="text-xs sm:text-sm">
                <p className="font-medium mb-1">Error en la validación con SUNAT:</p>
                <p className="text-[10px] sm:text-xs">{invoice.efact_error || "Error desconocido"}</p>
              </AlertDescription>
            </Alert>
          )}

          {isProcessing && (
            <Alert className="bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800 py-2 sm:py-3">
              <Clock className="h-3 w-3 sm:h-4 sm:w-4 text-yellow-600" />
              <AlertDescription className="text-yellow-700 dark:text-yellow-400 text-xs sm:text-sm">
                El comprobante está siendo procesado por SUNAT. Puedes verificar el estado más tarde.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2 pt-2">
          <Button
            variant="outline"
            onClick={onViewInvoice}
            className="w-full sm:w-auto text-sm"
          >
            <FileText className="mr-2 h-4 w-4" />
            Ver Detalles
          </Button>
          {isSuccess && (
            <Button
              onClick={onDownloadPdf}
              className="w-full sm:w-auto text-sm"
            >
              <Download className="mr-2 h-4 w-4" />
              Descargar PDF
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

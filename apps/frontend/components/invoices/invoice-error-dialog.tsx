"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { XCircle, AlertTriangle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface InvoiceErrorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  errorMessage: string;
  errorDetails?: string;
  onRetry?: () => void;
  onViewDetails?: () => void;
}

export function InvoiceErrorDialog({
  open,
  onOpenChange,
  errorMessage,
  errorDetails,
  onRetry,
  onViewDetails,
}: InvoiceErrorDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-[450px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex flex-col items-center space-y-3 sm:space-y-4 py-2 sm:py-4">
            <div className="rounded-full bg-red-100 dark:bg-red-900/20 p-2 sm:p-3">
              <XCircle className="h-8 w-8 sm:h-12 sm:w-12 text-red-600 dark:text-red-500" />
            </div>
            <DialogTitle className="text-lg sm:text-2xl font-bold text-center">
              Error al Emitir Comprobante
            </DialogTitle>
            <DialogDescription className="text-center text-xs sm:text-sm">
              Hubo un problema al generar el comprobante electrónico
            </DialogDescription>
          </div>
        </DialogHeader>

        <div className="space-y-3 sm:space-y-4 py-2 sm:py-4">
          <Alert variant="destructive" className="py-2 sm:py-3">
            <AlertTriangle className="h-3 w-3 sm:h-4 sm:w-4" />
            <AlertDescription className="font-medium text-xs sm:text-sm">
              {errorMessage}
            </AlertDescription>
          </Alert>

          {errorDetails && (
            <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 sm:p-4 space-y-2">
              <p className="text-xs sm:text-sm font-medium">Detalles del error:</p>
              <p className="text-[10px] sm:text-xs text-muted-foreground font-mono break-all">
                {errorDetails}
              </p>
            </div>
          )}

          <div className="space-y-2 text-xs sm:text-sm text-muted-foreground">
            <p className="font-medium">Posibles causas:</p>
            <ul className="list-disc list-inside space-y-1 text-[10px] sm:text-xs">
              <li>Serie de numeración no configurada correctamente</li>
              <li>Datos del cliente incompletos o inválidos</li>
              <li>Error de conexión con SUNAT/eFact</li>
              <li>Certificado digital no válido o vencido</li>
            </ul>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2 pt-2">
          {onRetry && (
            <Button
              variant="outline"
              onClick={onRetry}
              className="w-full sm:w-auto text-sm"
            >
              Reintentar
            </Button>
          )}
          {onViewDetails && (
            <Button
              variant="outline"
              onClick={onViewDetails}
              className="w-full sm:w-auto text-sm"
            >
              Ver Detalles
            </Button>
          )}
          <Button
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto text-sm"
          >
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

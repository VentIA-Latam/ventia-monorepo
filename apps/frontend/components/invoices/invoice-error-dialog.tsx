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
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <div className="flex flex-col items-center space-y-4 py-4">
            <div className="rounded-full bg-red-100 dark:bg-red-900/20 p-3">
              <XCircle className="h-12 w-12 text-red-600 dark:text-red-500" />
            </div>
            <DialogTitle className="text-2xl font-bold text-center">
              Error al Emitir Comprobante
            </DialogTitle>
            <DialogDescription className="text-center">
              Hubo un problema al generar el comprobante electrónico
            </DialogDescription>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="font-medium">
              {errorMessage}
            </AlertDescription>
          </Alert>

          {errorDetails && (
            <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 space-y-2">
              <p className="text-sm font-medium">Detalles del error:</p>
              <p className="text-xs text-muted-foreground font-mono">
                {errorDetails}
              </p>
            </div>
          )}

          <div className="space-y-2 text-sm text-muted-foreground">
            <p className="font-medium">Posibles causas:</p>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>Serie de numeración no configurada correctamente</li>
              <li>Datos del cliente incompletos o inválidos</li>
              <li>Error de conexión con SUNAT/eFact</li>
              <li>Certificado digital no válido o vencido</li>
            </ul>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {onRetry && (
            <Button
              variant="outline"
              onClick={onRetry}
              className="w-full sm:w-auto"
            >
              Reintentar
            </Button>
          )}
          {onViewDetails && (
            <Button
              variant="outline"
              onClick={onViewDetails}
              className="w-full sm:w-auto"
            >
              Ver Detalles
            </Button>
          )}
          <Button
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto"
          >
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, FileText, AlertCircle } from "lucide-react";
import { InvoiceSuccessDialog } from "@/components/invoices/invoice-success-dialog";
import { InvoiceErrorDialog } from "@/components/invoices/invoice-error-dialog";
import {
  InvoiceCreate,
  InvoiceSerie,
  INVOICE_TYPES,
  INVOICE_TYPE_NAMES,
  Invoice,
} from "@/lib/types/invoice";
import { Order } from "@/lib/services/order-service";

interface CreateInvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: Order;
  onSuccess: () => void;
}

export function CreateInvoiceDialog({
  open,
  onOpenChange,
  order,
  onSuccess,
}: CreateInvoiceDialogProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invoiceType, setInvoiceType] = useState<string>(INVOICE_TYPES.FACTURA);
  const [serie, setSerie] = useState<string>("");
  const [series, setSeries] = useState<InvoiceSerie[]>([]);
  const [isLoadingSeries, setIsLoadingSeries] = useState(false);

  // Estados para modales de éxito/error
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [showErrorDialog, setShowErrorDialog] = useState(false);
  const [createdInvoice, setCreatedInvoice] = useState<Invoice | null>(null);
  const [errorDetails, setErrorDetails] = useState<string>("");

  const loadSeries = async () => {
    try {
      setIsLoadingSeries(true);

      // Obtener token del cliente
      const tokenRes = await fetch("/api/auth/token", { credentials: "include" });
      if (!tokenRes.ok) throw new Error("No se pudo obtener el token");
      const { accessToken } = await tokenRes.json();

      // Llamar al backend directamente
      const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
      const response = await fetch(`${API_URL}/invoice-series`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!response.ok) throw new Error("Error al cargar series");

      const allSeries: InvoiceSerie[] = await response.json();

      // Filtrar series activas del tipo seleccionado
      const filteredSeries = allSeries.filter(
        (s) => s.invoice_type === invoiceType && s.is_active
      );

      setSeries(filteredSeries);

      // Auto-seleccionar la primera serie si existe
      if (filteredSeries.length > 0 && !serie) {
        setSerie(filteredSeries[0].serie);
      }
    } catch (err) {
      console.error("Error loading series:", err);
      setError("No se pudieron cargar las series disponibles");
    } finally {
      setIsLoadingSeries(false);
    }
  };

  // Cargar series disponibles cuando se abre el diálogo
  useEffect(() => {
    if (open) {
      loadSeries();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, invoiceType]);

  const handleSubmit = async () => {
    try {
      setIsCreating(true);
      setError(null);

      if (!serie) {
        setError("Debe seleccionar una serie");
        return;
      }

      const invoiceData: InvoiceCreate = {
        invoice_type: invoiceType as "01" | "03" | "07" | "08",
        serie: serie,
      };

      // Obtener token del cliente
      const tokenRes = await fetch("/api/auth/token", { credentials: "include" });
      if (!tokenRes.ok) throw new Error("No se pudo obtener el token");
      const { accessToken } = await tokenRes.json();

      // Llamar al backend directamente - RUTA CORREGIDA
      const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
      const response = await fetch(`${API_URL}/invoices/${order.id}/invoice`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(invoiceData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Error al crear el comprobante");
      }

      const newInvoice: Invoice = await response.json();

      // Éxito: cerrar diálogo principal y mostrar modal de éxito
      onOpenChange(false);
      setCreatedInvoice(newInvoice);
      setShowSuccessDialog(true);
    } catch (err) {
      console.error("Error creating invoice:", err);
      const errorMessage = err instanceof Error ? err.message : "Error al crear el comprobante electrónico";
      setError(errorMessage);
      setErrorDetails(err instanceof Error ? err.stack || "" : "");
      setShowErrorDialog(true);
    } finally {
      setIsCreating(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!isCreating) {
      onOpenChange(newOpen);
      // Resetear estado cuando se cierra
      if (!newOpen) {
        setError(null);
        setSerie("");
      }
    }
  };

  const canCreateInvoice =
    order.validado &&
    order.customer_document_type &&
    order.customer_document_number;

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Generar Comprobante Electrónico
            </DialogTitle>
            <DialogDescription>
              Orden #{order.id} - {order.customer_name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Validaciones previas */}
            {!order.validado && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  La orden debe estar validada antes de generar un comprobante.
                </AlertDescription>
              </Alert>
            )}

            {order.validado &&
              (!order.customer_document_type ||
                !order.customer_document_number) && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    La orden debe tener datos completos del cliente (tipo y número
                    de documento).
                  </AlertDescription>
                </Alert>
              )}

            {canCreateInvoice && (
              <>
                {/* Tipo de Comprobante */}
                <div className="space-y-2">
                  <Label htmlFor="invoice-type">Tipo de Comprobante</Label>
                  <Select value={invoiceType} onValueChange={setInvoiceType}>
                    <SelectTrigger id="invoice-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={INVOICE_TYPES.FACTURA}>
                        {INVOICE_TYPE_NAMES[INVOICE_TYPES.FACTURA]}
                      </SelectItem>
                      <SelectItem value={INVOICE_TYPES.BOLETA}>
                        {INVOICE_TYPE_NAMES[INVOICE_TYPES.BOLETA]}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {invoiceType === INVOICE_TYPES.FACTURA
                      ? "Para clientes con RUC (personas jurídicas)"
                      : "Para clientes con DNI/CE (personas naturales)"}
                  </p>
                </div>

                {/* Serie */}
                <div className="space-y-2">
                  <Label htmlFor="serie">Serie de Numeración</Label>
                  {isLoadingSeries ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="ml-2 text-sm text-muted-foreground">
                        Cargando series...
                      </span>
                    </div>
                  ) : series.length > 0 ? (
                    <Select value={serie} onValueChange={setSerie}>
                      <SelectTrigger id="serie">
                        <SelectValue placeholder="Seleccione una serie" />
                      </SelectTrigger>
                      <SelectContent>
                        {series.map((s) => (
                          <SelectItem key={s.id} value={s.serie}>
                            {s.serie} - {s.description || "Sin descripción"}
                            {" (Último: "}
                            {String(s.last_correlativo).padStart(8, "0")})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        No hay series activas configuradas para este tipo de
                        comprobante. Contacte al administrador.
                      </AlertDescription>
                    </Alert>
                  )}
                  <p className="text-xs text-muted-foreground">
                    El número correlativo se asignará automáticamente
                  </p>
                </div>

                {/* Información de la orden */}
                <div className="rounded-lg border p-3 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Cliente:</span>
                    <span className="font-medium">{order.customer_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Documento:</span>
                    <span className="font-medium">
                      {order.customer_document_type}{" "}
                      {order.customer_document_number}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total:</span>
                    <span className="font-bold text-primary">
                      {order.currency} {order.total_price.toFixed(2)}
                    </span>
                  </div>
                </div>
              </>
            )}

            {/* Error */}
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isCreating}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isCreating || !canCreateInvoice || !serie}
            >
              {isCreating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generando...
                </>
              ) : (
                <>
                  <FileText className="mr-2 h-4 w-4" />
                  Generar Comprobante
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Éxito */}
      <InvoiceSuccessDialog
        open={showSuccessDialog}
        onOpenChange={(open) => {
          setShowSuccessDialog(open);
          if (!open) {
            onSuccess(); // Notificar al componente padre
          }
        }}
        invoice={createdInvoice}
        onViewInvoice={() => {
          if (createdInvoice) {
            window.location.href = `/dashboard/invoices/${createdInvoice.id}`;
          }
        }}
        onDownloadPdf={async () => {
          if (createdInvoice) {
            try {
              const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

              // Obtener token
              const tokenRes = await fetch("/api/auth/token", { credentials: "include" });
              if (!tokenRes.ok) throw new Error("No se pudo obtener el token");
              const { accessToken } = await tokenRes.json();

              // Descargar PDF con token
              const response = await fetch(`${API_URL}/invoices/${createdInvoice.id}/pdf`, {
                headers: { Authorization: `Bearer ${accessToken}` },
              });

              if (!response.ok) throw new Error("Error al descargar PDF");

              // Crear blob y descargar
              const blob = await response.blob();
              const url = window.URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `${createdInvoice.serie}-${createdInvoice.correlativo}.pdf`;
              document.body.appendChild(a);
              a.click();
              window.URL.revokeObjectURL(url);
              document.body.removeChild(a);
            } catch (err) {
              console.error("Error downloading PDF:", err);
              alert("Error al descargar el PDF");
            }
          }
        }}
      />

      {/* Modal de Error */}
      <InvoiceErrorDialog
        open={showErrorDialog}
        onOpenChange={setShowErrorDialog}
        errorMessage={error || "Error desconocido"}
        errorDetails={errorDetails}
        onRetry={() => {
          setShowErrorDialog(false);
          setError(null);
          setErrorDetails("");
          handleSubmit();
        }}
      />
    </>
  );
}

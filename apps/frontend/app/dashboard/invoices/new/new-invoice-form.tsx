"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, FileText, Save, AlertCircle, Loader2 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { InvoiceSuccessDialog } from "@/components/invoices/invoice-success-dialog";
import { InvoiceErrorDialog } from "@/components/invoices/invoice-error-dialog";
import type { Order } from "@/lib/services/order-service";
import type { Invoice, InvoiceSerie, InvoiceCreate } from "@/lib/types/invoice";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

interface NewInvoiceFormProps {
  order: Order;
  existingInvoices: Invoice[];
}

export function NewInvoiceForm({ order, existingInvoices }: NewInvoiceFormProps) {
  const router = useRouter();

  // Estados del formulario
  const [invoiceType, setInvoiceType] = useState<string>("");
  const [series, setSeries] = useState<InvoiceSerie[]>([]);
  const [selectedSerie, setSelectedSerie] = useState<string>("");
  const [referenceInvoiceId, setReferenceInvoiceId] = useState<string>("");
  const [motivo, setMotivo] = useState<string>("");

  // Estados de carga y errores
  const [loadingSeries, setLoadingSeries] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Estados de modales
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showLoadingDialog, setShowLoadingDialog] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [showErrorDialog, setShowErrorDialog] = useState(false);
  const [createdInvoice, setCreatedInvoice] = useState<Invoice | null>(null);
  const [errorDetails, setErrorDetails] = useState<string>("");

  // Determinar si el cliente tiene RUC
  const hasRUC = order.customer_document_type === "6" && order.customer_document_number?.length === 11;

  // Facturas válidas como referencia (solo success)
  const validReferenceInvoices = existingInvoices.filter(
    (inv) => inv.invoice_type === "01" && inv.efact_status === "success"
  );

  // 1️⃣ Cargar series cuando cambia el tipo de invoice
  useEffect(() => {
    if (!invoiceType) {
      setSeries([]);
      setSelectedSerie("");
      return;
    }

    const fetchSeries = async () => {
      setLoadingSeries(true);
      setError(null);

      try {
        // Obtener token
        const tokenRes = await fetch("/api/auth/token", {
          credentials: "include",
        });

        if (!tokenRes.ok) {
          throw new Error("No se pudo obtener el token de autenticación");
        }

        const { accessToken } = await tokenRes.json();

        // Cargar series
        const response = await fetch(`${API_URL}/invoice-series`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        if (!response.ok) {
          throw new Error("Error al cargar las series");
        }

        const allSeries: InvoiceSerie[] = await response.json();

        // Filtrar por tipo y activas
        const filtered = allSeries.filter(
          (s) => s.invoice_type === invoiceType && s.is_active
        );

        setSeries(filtered);

        // Seleccionar la primera serie disponible
        if (filtered.length > 0) {
          setSelectedSerie(filtered[0].id.toString());
        } else {
          setSelectedSerie("");
        }
      } catch (err) {
        console.error("Error fetching series:", err);
        setError(err instanceof Error ? err.message : "Error al cargar series");
        setSeries([]);
        setSelectedSerie("");
      } finally {
        setLoadingSeries(false);
      }
    };

    fetchSeries();
  }, [invoiceType]);

  // 2️⃣ Validar si NC/ND requiere referencia
  const requiresReference = invoiceType === "07" || invoiceType === "08";

  // 3️⃣ Calcular totales
  const subtotal = order.total_price / 1.18;
  const igv = order.total_price - subtotal;

  // 4️⃣ Handler de submit - Muestra modal de confirmación
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validaciones
    if (!invoiceType) {
      setError("Selecciona un tipo de comprobante");
      return;
    }

    if (!selectedSerie) {
      setError("Selecciona una serie");
      return;
    }

    if (requiresReference && !referenceInvoiceId) {
      setError("Debes seleccionar un comprobante de referencia");
      return;
    }

    if (requiresReference && !motivo.trim()) {
      setError("Debes ingresar un motivo");
      return;
    }

    // Mostrar modal de confirmación
    setShowConfirmDialog(true);
  };

  // 5️⃣ Confirmación y creación del invoice
  const handleConfirmCreate = async () => {
    setShowConfirmDialog(false);
    setShowLoadingDialog(true);
    setSubmitting(true);
    setError(null);

    try {
      // Obtener token
      const tokenRes = await fetch("/api/auth/token", {
        credentials: "include",
      });

      if (!tokenRes.ok) {
        throw new Error("No se pudo obtener el token de autenticación");
      }

      const { accessToken } = await tokenRes.json();

      // Buscar la serie seleccionada para obtener su código
      const selectedSerieObj = series.find(s => s.id.toString() === selectedSerie);
      if (!selectedSerieObj) {
        throw new Error("Serie no encontrada");
      }

      // Preparar payload según el schema del backend
      const payload = {
        invoice_type: invoiceType,
        serie: selectedSerieObj.serie, // String como "B001", no ID
        reference_invoice_id: requiresReference && referenceInvoiceId
          ? parseInt(referenceInvoiceId)
          : undefined,
        reference_reason: requiresReference ? motivo : undefined, // "reference_reason" no "motivo"
      };

      // Crear invoice - La ruta correcta es /invoices/{orderId}/invoice
      const response = await fetch(`${API_URL}/invoices/${order.id}/invoice`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || "Error al crear el comprobante");
      }

      const newInvoice: Invoice = await response.json();

      // Cerrar modal de carga y mostrar modal de éxito
      setShowLoadingDialog(false);
      setCreatedInvoice(newInvoice);
      setShowSuccessDialog(true);
    } catch (err) {
      console.error("Error creating invoice:", err);
      setShowLoadingDialog(false);

      const errorMessage = err instanceof Error ? err.message : "Error desconocido";
      setError(errorMessage);
      setErrorDetails(err instanceof Error ? err.stack || "" : "");
      setShowErrorDialog(true);
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link href={`/dashboard/orders/${order.id}`}>
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver a la Orden
            </Button>
          </Link>
          <h1 className="text-3xl font-bold mt-2">Crear Comprobante</h1>
          <p className="text-muted-foreground">
            Orden #{order.shopify_draft_order_id} • {order.customer_name}
          </p>
        </div>
        <FileText className="h-12 w-12 text-muted-foreground" />
      </div>

      {/* Mostrar error si existe */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Formulario */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Información del Comprobante</CardTitle>
              <CardDescription>
                Completa los datos necesarios para emitir el comprobante
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Tipo de Comprobante */}
                <div className="space-y-2">
                  <Label htmlFor="invoice-type">Tipo de Comprobante *</Label>
                  <Select value={invoiceType} onValueChange={setInvoiceType}>
                    <SelectTrigger id="invoice-type">
                      <SelectValue placeholder="Selecciona un tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="01" disabled={!hasRUC}>
                        Factura {!hasRUC && "(Cliente debe tener RUC)"}
                      </SelectItem>
                      <SelectItem value="03">Boleta</SelectItem>
                      <SelectItem value="07">Nota de Crédito</SelectItem>
                      <SelectItem value="08">Nota de Débito</SelectItem>
                    </SelectContent>
                  </Select>
                  {!hasRUC && (
                    <p className="text-sm text-muted-foreground">
                      Cliente no tiene RUC, solo puede emitir Boleta, NC o ND
                    </p>
                  )}
                </div>

                {/* Serie */}
                <div className="space-y-2">
                  <Label htmlFor="serie">Serie *</Label>
                  {loadingSeries ? (
                    <div className="flex items-center gap-2 p-2 border rounded-md">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm text-muted-foreground">Cargando series...</span>
                    </div>
                  ) : series.length === 0 && invoiceType ? (
                    <div className="p-4 border rounded-md bg-muted">
                      <p className="text-sm text-muted-foreground">
                        No hay series activas para este tipo de comprobante
                      </p>
                    </div>
                  ) : (
                    <Select
                      value={selectedSerie}
                      onValueChange={setSelectedSerie}
                      disabled={!invoiceType || series.length === 0}
                    >
                      <SelectTrigger id="serie">
                        <SelectValue placeholder="Selecciona una serie" />
                      </SelectTrigger>
                      <SelectContent>
                        {series.map((s) => (
                          <SelectItem key={s.id} value={s.id.toString()}>
                            {s.serie}{s.description ? ` - ${s.description}` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                {/* Número de Comprobante (calculado automáticamente) */}
                {selectedSerie && (
                  <div className="space-y-2">
                    <Label>Número de Comprobante</Label>
                    <div className="p-3 border rounded-md bg-muted/50 text-muted-foreground font-mono">
                      {(() => {
                        const selectedSerieObj = series.find(s => s.id.toString() === selectedSerie);
                        if (!selectedSerieObj) return "-";
                        return `${selectedSerieObj.serie}-${String(selectedSerieObj.last_correlativo + 1).padStart(8, "0")}`;
                      })()}
                    </div>
                  </div>
                )}

                {/* Referencia (solo para NC/ND) */}
                {requiresReference && (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      <Label htmlFor="reference">Comprobante de Referencia *</Label>
                      {validReferenceInvoices.length === 0 ? (
                        <Alert>
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription>
                            No hay facturas válidas para referenciar. Debes tener al menos una
                            factura emitida con éxito para crear una {invoiceType === "07" ? "Nota de Crédito" : "Nota de Débito"}.
                          </AlertDescription>
                        </Alert>
                      ) : (
                        <Select value={referenceInvoiceId} onValueChange={setReferenceInvoiceId}>
                          <SelectTrigger id="reference">
                            <SelectValue placeholder="Selecciona un comprobante" />
                          </SelectTrigger>
                          <SelectContent>
                            {validReferenceInvoices.map((inv) => (
                              <SelectItem key={inv.id} value={inv.id.toString()}>
                                {inv.serie}-{inv.correlativo} (S/ {inv.total.toFixed(2)})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="motivo">
                        Motivo de {invoiceType === "07" ? "Crédito" : "Débito"} *
                      </Label>
                      <Textarea
                        id="motivo"
                        placeholder="Describe el motivo..."
                        value={motivo}
                        onChange={(e) => setMotivo(e.target.value)}
                        rows={3}
                      />
                    </div>
                  </>
                )}

                {/* Botones */}
                <div className="flex gap-3 pt-4">
                  <Button
                    type="submit"
                    disabled={submitting || loadingSeries || !invoiceType || !selectedSerie}
                    className="flex-1"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creando...
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        Crear Comprobante
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => router.back()}
                    disabled={submitting}
                  >
                    Cancelar
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Preview/Info */}
        <div className="space-y-6">
          {/* Información de la Orden */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Datos de la Orden</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Número de Orden</p>
                <p className="font-medium">{order.shopify_draft_order_id}</p>
              </div>

              <Separator />

              <div>
                <p className="text-sm text-muted-foreground">Cliente</p>
                <p className="font-medium">{order.customer_name}</p>
                <p className="text-sm">
                  {order.customer_document_type === "6" ? "RUC" : "DNI"}: {order.customer_document_number}
                </p>
              </div>

              <Separator />

              <div>
                <p className="text-sm text-muted-foreground">Estado</p>
                <Badge variant={order.validado ? "default" : "secondary"}>
                  {order.validado ? "Validado" : "No Validado"}
                </Badge>
              </div>

              <Separator />

              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Subtotal:</span>
                  <span className="font-medium">S/ {subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">IGV (18%):</span>
                  <span className="font-medium">S/ {igv.toFixed(2)}</span>
                </div>
                <Separator />
                <div className="flex justify-between text-lg">
                  <span className="font-bold">Total:</span>
                  <span className="font-bold">S/ {order.total_price.toFixed(2)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Comprobantes Existentes */}
          {existingInvoices.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Comprobantes Existentes</CardTitle>
                <CardDescription>
                  {existingInvoices.length} comprobante(s) emitido(s)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {existingInvoices.map((inv) => (
                    <div
                      key={inv.id}
                      className="flex items-center justify-between p-2 border rounded-md"
                    >
                      <div>
                        <p className="text-sm font-medium">
                          {inv.serie}-{inv.correlativo}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {inv.invoice_type === "01" ? "Factura" :
                            inv.invoice_type === "03" ? "Boleta" :
                              inv.invoice_type === "07" ? "NC" : "ND"}
                        </p>
                      </div>
                      <Badge
                        variant={
                          inv.efact_status === "success" ? "default" :
                            inv.efact_status === "processing" ? "secondary" : "destructive"
                        }
                      >
                        {inv.efact_status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Modal de Confirmación */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Creación de Comprobante</DialogTitle>
            <DialogDescription>
              ¿Estás seguro de crear este comprobante electrónico?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Tipo:</span>
                <span className="font-medium">
                  {invoiceType === "01" ? "Factura" :
                    invoiceType === "03" ? "Boleta" :
                      invoiceType === "07" ? "Nota de Crédito" : "Nota de Débito"}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Serie:</span>
                <span className="font-medium">
                  {series.find(s => s.id.toString() === selectedSerie)?.serie}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Cliente:</span>
                <span className="font-medium">{order.customer_name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total:</span>
                <span className="font-bold">S/ {order.total_price.toFixed(2)}</span>
              </div>
            </div>
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                El comprobante será enviado a SUNAT para su procesamiento.
                Esta acción no se puede deshacer.
              </AlertDescription>
            </Alert>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleConfirmCreate}>
              Confirmar y Crear
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Carga */}
      <Dialog open={showLoadingDialog} onOpenChange={() => { }}>
        <DialogContent className="sm:max-w-md" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              Creando Comprobante
            </DialogTitle>
            <DialogDescription>
              Por favor espera mientras procesamos tu solicitud...
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center py-8 space-y-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <div className="text-center space-y-2">
              <p className="text-sm font-medium">Generando comprobante electrónico</p>
              <p className="text-xs text-muted-foreground">
                Enviando a SUNAT para validación...
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Éxito */}
      <InvoiceSuccessDialog
        open={showSuccessDialog}
        onOpenChange={setShowSuccessDialog}
        invoice={createdInvoice}
        onViewInvoice={() => {
          if (createdInvoice) {
            router.push(`/dashboard/invoices/${createdInvoice.id}`);
          }
        }}
        onDownloadPdf={async () => {
          if (createdInvoice) {
            try {
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
          handleConfirmCreate();
        }}
      />
    </div>
  );
}


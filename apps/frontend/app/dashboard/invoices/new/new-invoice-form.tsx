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
import { SendEmailDialog } from "@/components/invoices/send-email-dialog";
import { useToast } from "@/hooks/use-toast";
import type { Order } from "@/lib/services/order-service";
import type { Invoice, InvoiceSerie, InvoiceCreate } from "@/lib/types/invoice";
import { getCompletedOrderId } from "@/lib/utils";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

interface NewInvoiceFormProps {
  order: Order;
  existingInvoices: Invoice[];
}

export function NewInvoiceForm({ order, existingInvoices }: NewInvoiceFormProps) {
  const router = useRouter();
  const { toast } = useToast();

  // Estados del formulario
  const [invoiceType, setInvoiceType] = useState<string>("");
  const [series, setSeries] = useState<InvoiceSerie[]>([]);
  const [selectedSerie, setSelectedSerie] = useState<string>("");
  const [referenceInvoiceId, setReferenceInvoiceId] = useState<string>("");
  const [motivo, setMotivo] = useState<string>("");

  // Estados de datos del cliente (editables)
  const [customerDocumentType, setCustomerDocumentType] = useState<string>(
    order.customer_document_type || "1"
  );
  const [customerDocumentNumber, setCustomerDocumentNumber] = useState<string>(
    order.customer_document_number || ""
  );
  const [customerName, setCustomerName] = useState<string>(
    order.customer_name || ""
  );
  const [customerEmail, setCustomerEmail] = useState<string>(
    order.customer_email || ""
  );

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

  // Estados para envío de email
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);

  // Determinar si el cliente tiene RUC (usar estado editable)
  const hasRUC = customerDocumentType === "6" && customerDocumentNumber?.length === 11;

  // Validación de documento según tipo de comprobante
  const getDocumentValidationError = (): string | null => {
    // Si no se ha seleccionado tipo de comprobante, no validar aún
    if (!invoiceType) return null;

    // Validación para Factura (01)
    if (invoiceType === "01") {
      if (customerDocumentType !== "6") {
        return "Para emitir Factura, el cliente debe tener RUC";
      }
      if (customerDocumentNumber.length !== 11) {
        return "El RUC debe tener exactamente 11 dígitos para emitir Factura";
      }
    }

    // Validación para Boleta (03)
    if (invoiceType === "03") {
      // Boleta acepta DNI (8 dígitos), Sin documento (0), u otros
      if (customerDocumentType === "1" && customerDocumentNumber.length > 0 && customerDocumentNumber.length !== 8) {
        return "El DNI debe tener exactamente 8 dígitos";
      }
    }

    return null;
  };

  const documentValidationError = getDocumentValidationError();

  // Facturas válidas como referencia (solo success)
  const validReferenceInvoices = existingInvoices.filter(
    (inv) => inv.invoice_type === "01" && inv.efact_status === "success"
  );

  // 1️⃣ Handle "Sin documento" option - Auto-fill 00000000 and NINGUNO
  useEffect(() => {
    if (customerDocumentType === "0") {
      setCustomerDocumentNumber("00000000");
      setCustomerName("NINGUNO");
    }
  }, [customerDocumentType]);

  // 1️⃣.1 Handle DNI 00000000 - Auto-fill name as NINGUNO (solo para DNI)
  useEffect(() => {
    if (customerDocumentType === "1" && customerDocumentNumber === "00000000") {
      setCustomerName("NINGUNO");
    }
  }, [customerDocumentNumber, customerDocumentType]);

  // 2️⃣ Cargar series cuando cambia el tipo de invoice
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

  // 3️⃣ Validar si NC/ND requiere referencia
  const requiresReference = invoiceType === "07" || invoiceType === "08";

  // 4️⃣ Calcular totales
  const subtotal = order.total_price / 1.18;
  const igv = order.total_price - subtotal;

  // 5️⃣ Handler de submit - Muestra modal de confirmación
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validaciones
    if (!customerDocumentType) {
      setError("Selecciona un tipo de documento");
      return;
    }

    if (!customerDocumentNumber.trim()) {
      setError("Ingresa el número de documento");
      return;
    }

    if (!customerName.trim()) {
      setError("Ingresa el nombre o razón social del cliente");
      return;
    }

    // Validar email si está presente (opcional)
    if (customerEmail.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(customerEmail)) {
        setError("Ingresa un correo electrónico válido");
        return;
      }
    }

    // Validar RUC para facturas (debe tener 11 dígitos)
    if (invoiceType === "01") {
      if (customerDocumentType !== "6") {
        setError("Para emitir factura, el cliente debe tener RUC");
        return;
      }
      if (customerDocumentNumber.length !== 11) {
        setError("El RUC debe tener 11 dígitos");
        return;
      }
    }

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

  // 6️⃣ Confirmación y creación del invoice con validación automática
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
      const payload: InvoiceCreate = {
        invoice_type: invoiceType as "01" | "03" | "07" | "08",
        serie: selectedSerieObj.serie, // String como "B001", no ID
        reference_invoice_id: requiresReference && referenceInvoiceId
          ? parseInt(referenceInvoiceId)
          : undefined,
        reference_reason: requiresReference ? motivo : undefined, // "reference_reason" no "motivo"
        // Include customer data overrides if different from order
        cliente_tipo_documento: customerDocumentType !== order.customer_document_type
          ? customerDocumentType
          : undefined,
        cliente_numero_documento: customerDocumentNumber !== order.customer_document_number
          ? customerDocumentNumber
          : undefined,
        cliente_razon_social: customerName !== order.customer_name
          ? customerName
          : undefined,
        cliente_email: customerEmail !== order.customer_email
          ? customerEmail
          : undefined,
      };

      // Crear invoice - La ruta correcta es /orders/{orderId}/invoices
      const response = await fetch(`${API_URL}/orders/${order.id}/invoices`, {
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

      let newInvoice: Invoice = await response.json();

      // Verificar estado con eFact automáticamente (máximo 3 intentos, cada 3 segundos)
      let validationAttempts = 0;
      const maxAttempts = 3;
      const delayBetweenAttempts = 3000; // 3 segundos

      while (validationAttempts < maxAttempts && newInvoice.efact_status === "processing") {
        validationAttempts++;

        // Esperar antes de verificar
        await new Promise(resolve => setTimeout(resolve, delayBetweenAttempts));

        // Verificar estado
        const statusResponse = await fetch(`${API_URL}/invoices/${newInvoice.id}/status`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
        });

        if (statusResponse.ok) {
          newInvoice = await statusResponse.json();
        }
      }

      // Cerrar modal de carga y mostrar modal de resultado
      setShowLoadingDialog(false);
      setCreatedInvoice(newInvoice);
      setSubmitting(false);

      // Mostrar modal de éxito o error según el estado
      if (newInvoice.efact_status === "success") {
        setShowSuccessDialog(true);
      } else {
        // Si sigue en processing o tiene error, mostrar información
        setShowSuccessDialog(true); // Usamos el mismo modal pero mostrará el estado
      }
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

  // Handler para abrir el dialog de email
  const handleOpenEmailDialog = () => {
    if (!createdInvoice) return;

    // Validar que el comprobante fue exitoso
    if (createdInvoice.efact_status !== "success") {
      toast({
        title: "No se puede enviar",
        description: "Solo se pueden enviar comprobantes con estado exitoso.",
        variant: "destructive",
      });
      return;
    }

    // Validar que tenga email
    if (!createdInvoice.cliente_email) {
      toast({
        title: "Email no disponible",
        description: "El comprobante no tiene un email de cliente registrado.",
        variant: "destructive",
      });
      return;
    }

    setEmailDialogOpen(true);
  };

  // Handler para confirmar envío de email
  const handleConfirmSendEmail = async (email: string, includeXml: boolean) => {
    if (!createdInvoice) return;

    setSendingEmail(true);
    try {
      const response = await fetch(`/api/invoices/send-email/${createdInvoice.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipient_email: email,
          include_xml: includeXml,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Error al enviar el email");
      }

      toast({
        title: "Email enviado",
        description: `El comprobante ha sido enviado a ${data.sent_to}`,
      });

      setEmailDialogOpen(false);
    } catch (err) {
      console.error("Error sending email:", err);
      toast({
        title: "Error al enviar email",
        description: err instanceof Error ? err.message : "Error desconocido",
        variant: "destructive",
      });
    } finally {
      setSendingEmail(false);
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
          <h1 className="text-3xl font-bold mt-2 font-heading">Crear Comprobante</h1>
          <p className="text-muted-foreground">
            Orden #{getCompletedOrderId(order)} • {order.customer_name}
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
                {/* Datos del Cliente - Editables */}
                <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-sm">Datos del Cliente</h3>
                    <Badge variant="outline" className="text-xs">Editable</Badge>
                  </div>

                  {/* Tipo de Documento */}
                  <div className="space-y-2">
                    <Label htmlFor="customer-doc-type">Tipo de Documento *</Label>
                    <Select value={customerDocumentType} onValueChange={setCustomerDocumentType}>
                      <SelectTrigger id="customer-doc-type">
                        <SelectValue placeholder="Selecciona tipo de documento" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">Sin documento (para Boleta)</SelectItem>
                        <SelectItem value="1">DNI</SelectItem>
                        <SelectItem value="6">RUC</SelectItem>
                        <SelectItem value="4">Carné de Extranjería</SelectItem>
                        <SelectItem value="7">Pasaporte</SelectItem>
                      </SelectContent>
                    </Select>
                    {customerDocumentType === "0" && (
                      <p className="text-xs text-muted-foreground">
                        Se usará &quot;00000000&quot; y &quot;NINGUNO&quot; para boletas sin identificación
                      </p>
                    )}
                  </div>

                  {/* Número de Documento */}
                  <div className="space-y-2">
                    <Label htmlFor="customer-doc-number">Número de Documento *</Label>
                    <Input
                      id="customer-doc-number"
                      value={customerDocumentNumber}
                      onChange={(e) => setCustomerDocumentNumber(e.target.value)}
                      placeholder="Ingresa número de documento"
                      disabled={customerDocumentType === "0"}
                      maxLength={customerDocumentType === "6" ? 11 : customerDocumentType === "1" ? 8 : 20}
                    />
                    {customerDocumentType === "6" && customerDocumentNumber && customerDocumentNumber.length !== 11 && (
                      <p className="text-xs text-destructive">
                        El RUC debe tener exactamente 11 dígitos
                      </p>
                    )}
                  </div>

                  {/* Nombre/Razón Social */}
                  <div className="space-y-2">
                    <Label htmlFor="customer-name">Nombre / Razón Social *</Label>
                    <Input
                      id="customer-name"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Ingresa nombre o razón social"
                      disabled={customerDocumentType === "0"}
                    />
                  </div>

                  {/* Email */}
                  <div className="space-y-2">
                    <Label htmlFor="customer-email">Correo Electrónico</Label>
                    <Input
                      id="customer-email"
                      type="email"
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                      placeholder="Ingresa correo electrónico (opcional)"
                    />
                    <p className="text-xs text-muted-foreground">
                      El correo quedará registrado en el comprobante
                    </p>
                  </div>
                </div>

                <Separator />

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
                  {documentValidationError && (
                    <Alert variant="destructive" className="mt-2">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{documentValidationError}</AlertDescription>
                    </Alert>
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
                    disabled={submitting || loadingSeries || !invoiceType || !selectedSerie || !!documentValidationError}
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
                <p className="font-medium">{getCompletedOrderId(order)}</p>
              </div>

              <Separator />

              <div>
                <p className="text-sm text-muted-foreground">Cliente</p>
                <p className="font-medium">{customerName}</p>
                <p className="text-sm">
                  {customerDocumentType === "6" ? "RUC" : customerDocumentType === "1" ? "DNI" : customerDocumentType === "0" ? "Sin documento" : "Documento"}: {customerDocumentNumber}
                </p>
                {customerEmail && (
                  <p className="text-sm text-muted-foreground">
                    Email: {customerEmail}
                  </p>
                )}
                {(customerDocumentType !== order.customer_document_type ||
                  customerDocumentNumber !== order.customer_document_number ||
                  customerName !== order.customer_name ||
                  customerEmail !== order.customer_email) && (
                    <Badge variant="outline" className="text-xs mt-1">Datos modificados</Badge>
                  )}
              </div>

              <Separator />

              <div>
                <p className="text-sm text-muted-foreground">Estado</p>
                <Badge variant={order.validado ? "default" : "secondary"}>
                  {order.validado ? "Validado" : "No Validado"}
                </Badge>
              </div>

              <Separator />

              {/* Detalle de Productos */}
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground font-semibold">
                  Productos ({order.line_items?.length || 0} {order.line_items?.length === 1 ? 'item' : 'items'})
                </p>

                {order.line_items && order.line_items.length > 0 ? (
                  <div className="space-y-2">
                    {/* Tabla para pantallas grandes */}
                    <div className="hidden md:block border rounded-lg overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/50">
                          <tr>
                            <th className="text-left p-2 font-medium text-muted-foreground">Producto</th>
                            <th className="text-center p-2 font-medium text-muted-foreground w-20">Cant.</th>
                            <th className="text-right p-2 font-medium text-muted-foreground w-24">P. Unit.</th>
                            <th className="text-right p-2 font-medium text-muted-foreground w-24">Subtotal</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {order.line_items.map((item, index) => (
                            <tr key={item.id || index} className="hover:bg-muted/30">
                              <td className="p-2">
                                <p className="font-medium text-foreground">{item.product}</p>
                                {item.sku && (
                                  <p className="text-xs text-muted-foreground">SKU: {item.sku}</p>
                                )}
                              </td>
                              <td className="p-2 text-center">{item.quantity}</td>
                              <td className="p-2 text-right">S/ {item.unitPrice.toFixed(2)}</td>
                              <td className="p-2 text-right font-medium">S/ {item.subtotal.toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Cards para pantallas pequeñas */}
                    <div className="md:hidden space-y-2">
                      {order.line_items.map((item, index) => (
                        <div key={item.id || index} className="border rounded-lg p-3 space-y-2 bg-muted/20">
                          <div>
                            <p className="font-medium text-sm">{item.product}</p>
                            {item.sku && (
                              <p className="text-xs text-muted-foreground">SKU: {item.sku}</p>
                            )}
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Cantidad:</span>
                            <span className="font-medium">{item.quantity}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Precio Unit.:</span>
                            <span className="font-medium">S/ {item.unitPrice.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-sm pt-1 border-t">
                            <span className="text-muted-foreground font-medium">Subtotal:</span>
                            <span className="font-bold">S/ {item.subtotal.toFixed(2)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">
                    No hay productos en esta orden
                  </p>
                )}
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
      <Dialog open={showConfirmDialog} onOpenChange={(open) => {
        setShowConfirmDialog(open);
        if (!open) {
          // Si el usuario cierra el modal sin confirmar, resetear submitting
          setSubmitting(false);
        }
      }}>
        <DialogContent className="max-w-[95vw] sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg sm:text-xl">Confirmar Creación de Comprobante</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              Revisa los datos antes de enviar el comprobante a SUNAT
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 sm:space-y-4 py-2 sm:py-4">
            {/* Tipo y Serie */}
            <div className="rounded-lg border bg-muted/50 p-3 sm:p-4 space-y-2 sm:space-y-3">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1">
                <span className="text-xs sm:text-sm text-muted-foreground">Tipo de Documento:</span>
                <span className="font-semibold text-sm sm:text-base">
                  {invoiceType === "01" ? "Factura" :
                    invoiceType === "03" ? "Boleta de Venta" :
                      invoiceType === "07" ? "Nota de Crédito" : "Nota de Débito"}
                </span>
              </div>
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1">
                <span className="text-xs sm:text-sm text-muted-foreground">Serie:</span>
                <span className="font-semibold text-base sm:text-lg text-primary">
                  {series.find(s => s.id.toString() === selectedSerie)?.serie}
                </span>
              </div>
            </div>

            {/* Datos del Cliente */}
            <div className="space-y-2 sm:space-y-3 border rounded-lg p-3 sm:p-4">
              <h4 className="font-medium text-xs sm:text-sm text-muted-foreground">Datos del Cliente</h4>
              <div className="space-y-2">
                <div className="flex flex-col sm:flex-row sm:justify-between text-xs sm:text-sm gap-1">
                  <span className="text-muted-foreground">Nombre / Razón Social:</span>
                  <span className="font-medium sm:text-right break-words">{customerName}</span>
                </div>
                <div className="flex flex-col sm:flex-row sm:justify-between text-xs sm:text-sm gap-1">
                  <span className="text-muted-foreground">Tipo de Documento:</span>
                  <span className="font-medium">
                    {customerDocumentType === "6" ? "RUC" :
                      customerDocumentType === "1" ? "DNI" :
                        customerDocumentType === "0" ? "Sin documento" :
                          customerDocumentType === "4" ? "Carnet Extranjería" :
                            customerDocumentType === "7" ? "Pasaporte" : "Documento"}
                  </span>
                </div>
                <div className="flex flex-col sm:flex-row sm:justify-between text-xs sm:text-sm gap-1">
                  <span className="text-muted-foreground">Número de Documento:</span>
                  <span className="font-medium">{customerDocumentNumber}</span>
                </div>
                {customerEmail && (
                  <div className="flex flex-col sm:flex-row sm:justify-between text-xs sm:text-sm gap-1">
                    <span className="text-muted-foreground">Email:</span>
                    <span className="font-medium break-all">{customerEmail}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Productos */}
            <div className="space-y-2 sm:space-y-3 border rounded-lg p-3 sm:p-4">
              <h4 className="font-medium text-xs sm:text-sm text-muted-foreground">
                Productos ({order.line_items?.length ?? 0})
              </h4>
              <div className="space-y-2 max-h-28 sm:max-h-32 overflow-y-auto">
                {(order.line_items ?? []).map((item, idx) => (
                  <div key={idx} className="flex justify-between text-xs sm:text-sm py-1 border-b last:border-0 gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-xs truncate">{item.product}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.quantity} x {order.currency} {item.unitPrice.toFixed(2)}
                      </p>
                    </div>
                    <span className="font-medium text-xs sm:text-sm whitespace-nowrap">{order.currency} {item.subtotal.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Totales */}
            <div className="space-y-2 border rounded-lg p-3 sm:p-4 bg-muted/30">
              <div className="flex justify-between text-xs sm:text-sm">
                <span className="text-muted-foreground">Subtotal:</span>
                <span className="font-medium">{order.currency} {(order.total_price / 1.18).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xs sm:text-sm">
                <span className="text-muted-foreground">IGV (18%):</span>
                <span className="font-medium">{order.currency} {(order.total_price - (order.total_price / 1.18)).toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center text-sm sm:text-base font-bold pt-2 border-t">
                <span>Total:</span>
                <span className="text-primary text-base sm:text-xl">{order.currency} {order.total_price.toFixed(2)}</span>
              </div>
            </div>

            {/* Advertencia */}
            <Alert className="py-2 sm:py-3">
              <AlertCircle className="h-3 w-3 sm:h-4 sm:w-4" />
              <AlertDescription className="text-[10px] sm:text-xs">
                El comprobante será enviado a SUNAT para su validación.
                Esta acción no se puede deshacer.
              </AlertDescription>
            </Alert>
          </div>
          <DialogFooter className="flex-col-reverse sm:flex-row gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => setShowConfirmDialog(false)}
              className="w-full sm:w-auto text-sm"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmCreate}
              className="w-full sm:w-auto text-sm"
            >
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
              Procesando Comprobante
            </DialogTitle>
            <DialogDescription>
              Por favor espera mientras validamos con SUNAT...
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center py-8 space-y-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <div className="text-center space-y-2">
              <p className="text-sm font-medium">Generando comprobante electrónico</p>
              <p className="text-xs text-muted-foreground">
                Enviando a SUNAT para validación...
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Este proceso puede tomar hasta 10 segundos
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Éxito */}
      <InvoiceSuccessDialog
        open={showSuccessDialog}
        onOpenChange={(open) => {
          setShowSuccessDialog(open);
          if (!open) {
            // Cuando se cierra el modal de éxito, asegurar que submitting está en false
            setSubmitting(false);
          }
        }}
        invoice={createdInvoice}
        onViewInvoice={() => {
          if (createdInvoice) {
            router.push(`/dashboard/invoices/${createdInvoice.id}`);
          }
        }}
        onDownloadPdf={async () => {
          if (createdInvoice) {
            try {
              // Descargar PDF via proxy route
              const response = await fetch(`/api/invoices/pdf/${createdInvoice.id}`);

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
        onSendEmail={handleOpenEmailDialog}
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

      {/* Modal de Envío de Email */}
      <SendEmailDialog
        open={emailDialogOpen}
        onOpenChange={setEmailDialogOpen}
        invoice={createdInvoice}
        onConfirm={handleConfirmSendEmail}
        loading={sendingEmail}
      />
    </div>
  );
}


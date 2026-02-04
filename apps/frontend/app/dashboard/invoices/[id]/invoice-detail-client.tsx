"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  FileText,
  Download,
  AlertCircle,
  Calendar,
  Clock,
  Loader2,
  CheckCircle,
  XCircle,
  RefreshCw,
  Mail,
} from "lucide-react";
import Link from "next/link";
import {
  Invoice,
  INVOICE_TYPE_NAMES,
  INVOICE_STATUS_NAMES,
  INVOICE_STATUS_COLORS
} from "@/lib/types/invoice";
import { formatDateTime } from "@/lib/utils";
import { SendEmailDialog } from "@/components/invoices/send-email-dialog";
import { useToast } from "@/hooks/use-toast";

interface InvoiceDetailClientProps {
  invoice: Invoice;
}

export function InvoiceDetailClient({ invoice: initialInvoice }: InvoiceDetailClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [invoice, setInvoice] = useState(initialInvoice);
  const [isDownloadingPDF, setIsDownloadingPDF] = useState(false);
  const [isDownloadingXML, setIsDownloadingXML] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);

  // Estados para envío de email
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);

  // Auto-polling DESACTIVADO - la factura cambia a success solo al descargar el PDF
  // useEffect(() => {
  //   if (invoice.efact_status !== "processing") return;

  //   const interval = setInterval(async () => {
  //     await handleCheckStatus();
  //   }, 5000); // 5 segundos

  //   return () => clearInterval(interval);
  // }, [invoice.efact_status]);

  const handleCheckStatus = async () => {
    try {
      setIsCheckingStatus(true);

      // Obtener token
      const tokenRes = await fetch("/api/auth/token", { credentials: "include" });
      if (!tokenRes.ok) throw new Error("No se pudo obtener el token");
      const { accessToken } = await tokenRes.json();

      // Llamar al backend
      const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
      const response = await fetch(`${API_URL}/invoices/${invoice.id}/status`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Error response:', response.status, errorData);
        throw new Error(errorData.detail || `Error ${response.status}: ${response.statusText}`);
      }

      const updatedInvoice = await response.json();
      setInvoice(updatedInvoice);

      // Mostrar mensaje según el resultado
      if (updatedInvoice.efact_status === 'success') {
        alert('✅ Factura validada exitosamente por SUNAT');
      } else if (updatedInvoice.efact_status === 'error') {
        alert(`❌ Error de validación: ${updatedInvoice.efact_error || 'Error desconocido'}`);
      } else if (updatedInvoice.efact_status === 'processing') {
        alert('⏳ La factura aún está en proceso de validación. Intenta nuevamente en unos segundos.');
      }

      // Si cambió a success o error, refrescar la página para asegurar datos actualizados
      if (updatedInvoice.efact_status !== "processing") {
        router.refresh();
      }
    } catch (err) {
      console.error("Error checking status:", err);
      alert(err instanceof Error ? err.message : "Error al verificar estado");
    } finally {
      setIsCheckingStatus(false);
    }
  };

  const handleDownloadPDF = async () => {
    try {
      setIsDownloadingPDF(true);

      // Obtener token
      const tokenRes = await fetch("/api/auth/token", { credentials: "include" });
      if (!tokenRes.ok) throw new Error("No se pudo obtener el token");
      const { accessToken } = await tokenRes.json();

      // Llamar al backend
      const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
      const response = await fetch(`${API_URL}/invoices/${invoice.id}/pdf`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Error al descargar PDF");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${invoice.full_number}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      // Refrescar los datos de la factura después de descargar
      router.refresh();
    } catch (err) {
      console.error("Error downloading PDF:", err);
      alert(err instanceof Error ? err.message : "Error al descargar el PDF");
    } finally {
      setIsDownloadingPDF(false);
    }
  };

  const handleDownloadXML = async () => {
    try {
      setIsDownloadingXML(true);

      // Obtener token
      const tokenRes = await fetch("/api/auth/token", { credentials: "include" });
      if (!tokenRes.ok) throw new Error("No se pudo obtener el token");
      const { accessToken } = await tokenRes.json();

      // Llamar al backend
      const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
      const response = await fetch(`${API_URL}/invoices/${invoice.id}/xml`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!response.ok) throw new Error("Error al descargar XML");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${invoice.full_number}.xml`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error("Error downloading XML:", err);
      alert(err instanceof Error ? err.message : "Error al descargar el XML");
    } finally {
      setIsDownloadingXML(false);
    }
  };

  // Handler para abrir dialog de email
  const handleOpenEmailDialog = () => {
    // Validar que el comprobante fue exitoso
    if (invoice.efact_status !== "success") {
      toast({
        title: "No se puede enviar",
        description: "Solo se pueden enviar comprobantes con estado exitoso.",
        variant: "destructive",
      });
      return;
    }

    // Validar que tenga email (opcional - el dialog permite editarlo)
    if (!invoice.cliente_email) {
      toast({
        title: "Advertencia",
        description: "El comprobante no tiene un email registrado. Deberás ingresarlo manualmente.",
        variant: "default",
      });
    }

    setEmailDialogOpen(true);
  };

  // Handler para confirmar envío de email
  const handleConfirmSendEmail = async (email: string, includeXml: boolean) => {
    setSendingEmail(true);
    try {
      const response = await fetch(`/api/invoices/send-email/${invoice.id}`, {
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

  const formatCurrency = (amount: number | undefined, currency: string) => {
    if (amount === undefined || amount === null) return '-';
    const symbols: Record<string, string> = {
      'USD': '$',
      'EUR': '€',
      'GBP': '£',
      'PEN': 'S/',
      'MXN': '$',
      'ARS': '$',
      'CLP': '$',
    };
    return `${symbols[currency] || currency} ${amount.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };



  const tipoComprobante = INVOICE_TYPE_NAMES[invoice.invoice_type] || invoice.invoice_type;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/invoices">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver a Facturación
            </Button>
          </Link>
        </div>
      </div>

      {/* Breadcrumb */}
      <nav className="flex text-sm text-gray-500">
        <Link href="/dashboard" className="hover:text-gray-900">
          Dashboard
        </Link>
        <span className="mx-2">/</span>
        <Link href="/dashboard/invoices" className="hover:text-gray-900">
          Facturación
        </Link>
        <span className="mx-2">/</span>
        <span className="text-gray-900">{invoice.full_number}</span>
      </nav>

      {/* Title */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
            {tipoComprobante}
          </h1>
          <p className="text-lg text-gray-600 mt-1">{invoice.full_number}</p>
        </div>
        <Badge className={`${INVOICE_STATUS_COLORS[invoice.efact_status]} text-sm px-3 py-1`}>
          {invoice.efact_status === 'success' && <CheckCircle className="h-4 w-4 mr-1" />}
          {invoice.efact_status === 'error' && <XCircle className="h-4 w-4 mr-1" />}
          {invoice.efact_status === 'processing' && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
          {INVOICE_STATUS_NAMES[invoice.efact_status]}
        </Badge>
      </div>

      {/* Error message */}
      {invoice.efact_status === 'error' && invoice.efact_error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error de SUNAT</AlertTitle>
          <AlertDescription>{invoice.efact_error}</AlertDescription>
        </Alert>
      )}

      {/* Processing message */}
      {invoice.efact_status === 'processing' && (
        <Alert>
          <Loader2 className="h-4 w-4 animate-spin" />
          <AlertTitle>En proceso</AlertTitle>
          <AlertDescription>
            La factura está siendo procesada por SUNAT. Esto puede tomar unos minutos.
            {invoice.efact_ticket && ` Ticket: ${invoice.efact_ticket}`}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 md:grid-cols-3">
        {/* Main Content */}
        <div className="md:col-span-2 space-y-6">
          {/* Información del Emisor */}
          <Card>
            <CardHeader>
              <CardTitle>Emisor</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm font-medium text-gray-500">Razón Social</p>
                <p className="text-base font-semibold mt-1">{invoice.emisor_razon_social}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">RUC</p>
                <p className="text-base font-mono mt-1">{invoice.emisor_ruc}</p>
              </div>
            </CardContent>
          </Card>

          {/* Información del Cliente */}
          <Card>
            <CardHeader>
              <CardTitle>Información del Cliente</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm font-medium text-gray-500">Nombre / Razón Social</p>
                <p className="text-base font-semibold mt-1">{invoice.cliente_razon_social}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-500">Tipo de Documento</p>
                  <p className="text-base mt-1">{invoice.cliente_tipo_documento}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Número de Documento</p>
                  <p className="text-base font-mono mt-1">{invoice.cliente_numero_documento}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Items */}
          {invoice.items && invoice.items.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Detalle de Items</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {invoice.items.map((item: any, index) => (
                    <div key={index} className="flex justify-between items-start pb-3 border-b last:border-b-0">
                      <div className="flex-1">
                        <p className="font-medium">{item.product || item.descripcion || '-'}</p>
                        <p className="text-sm text-gray-500">
                          SKU: {item.sku || '-'} • Cantidad: {item.quantity || item.cantidad || 0} x {formatCurrency(item.unitPrice || item.precio_unitario, invoice.currency)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">{formatCurrency(item.subtotal || item.total, invoice.currency)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Desglose de Montos */}
          <Card>
            <CardHeader>
              <CardTitle>Desglose de Montos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-base">
                <span className="text-gray-600">Subtotal (Op. Gravada)</span>
                <span className="font-medium">{formatCurrency(invoice.subtotal, invoice.currency)}</span>
              </div>
              <div className="flex justify-between text-base">
                <span className="text-gray-600">IGV (18%)</span>
                <span className="font-medium">{formatCurrency(invoice.igv, invoice.currency)}</span>
              </div>
              <Separator />
              <div className="flex justify-between text-lg">
                <span className="font-semibold">Total</span>
                <span className="font-bold text-primary">{formatCurrency(invoice.total, invoice.currency)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Referencia (para NC/ND) */}
          {invoice.reference_invoice_id && (
            <Card>
              <CardHeader>
                <CardTitle>Comprobante Referenciado</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-sm font-medium text-gray-500">Comprobante Referencia</p>
                  <p className="text-base font-mono mt-1">
                    {invoice.reference_serie}-{String(invoice.reference_correlativo).padStart(8, '0')}
                  </p>
                </div>
                {invoice.reference_reason && (
                  <div>
                    <p className="text-sm font-medium text-gray-500">Motivo</p>
                    <p className="text-base mt-1">{invoice.reference_reason}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Acciones */}
          <Card>
            <CardHeader>
              <CardTitle>Acciones</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {/* Botón Verificar Estado - visible cuando está en processing o error */}
              {(invoice.efact_status === 'processing' || invoice.efact_status === 'error') && (
                <Button
                  className="w-full"
                  variant="secondary"
                  size="sm"
                  onClick={handleCheckStatus}
                  disabled={isCheckingStatus}
                >
                  {isCheckingStatus ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Verificando...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Verificar Estado
                    </>
                  )}
                </Button>
              )}

              {/* Botón Enviar por Correo */}
              {invoice.efact_status === 'success' && (
                <Button
                  variant="secondary"
                  className="w-full"
                  size="sm"
                  onClick={handleOpenEmailDialog}
                  disabled={sendingEmail}
                >
                  <Mail className="h-4 w-4 mr-2" />
                  Enviar por Correo
                </Button>
              )}

              {/* Botón Descargar PDF */}
              <Button
                className="w-full"
                size="sm"
                onClick={handleDownloadPDF}
                disabled={isDownloadingPDF || invoice.efact_status !== 'success'}
              >
                {isDownloadingPDF ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Descargando...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    Descargar PDF
                  </>
                )}
              </Button>

              {/* Botón Descargar XML */}
              <Button
                variant="outline"
                className="w-full"
                size="sm"
                onClick={handleDownloadXML}
                disabled={isDownloadingXML}
              >
                {isDownloadingXML ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Descargando...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    Descargar XML
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Información de Emisión */}
          <Card>
            <CardHeader>
              <CardTitle>Información de Emisión</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <p className="text-gray-500 flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Fecha de Emisión
                </p>
                <p className="font-medium mt-1">{formatDateTime(invoice.created_at)}</p>
              </div>
              {invoice.efact_processed_at && (
                <div>
                  <p className="text-gray-500 flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Fecha de Validación
                  </p>
                  <p className="font-medium mt-1">{formatDateTime(invoice.efact_processed_at)}</p>
                </div>
              )}
              {invoice.efact_ticket && (
                <div>
                  <p className="text-gray-500">Ticket eFact</p>
                  <p className="font-mono text-xs mt-1 break-all">{invoice.efact_ticket}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Orden Relacionada */}
          <Card>
            <CardHeader>
              <CardTitle>Orden Relacionada</CardTitle>
            </CardHeader>
            <CardContent>
              <Link href={`/dashboard/orders/${invoice.order_id}`}>
                <Button variant="outline" className="w-full" size="sm">
                  <FileText className="h-4 w-4 mr-2" />
                  Ver Orden #{invoice.order_id}
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Modal de Envío de Email */}
      <SendEmailDialog
        open={emailDialogOpen}
        onOpenChange={setEmailDialogOpen}
        invoice={invoice}
        onConfirm={handleConfirmSendEmail}
        loading={sendingEmail}
      />
    </div>
  );
}

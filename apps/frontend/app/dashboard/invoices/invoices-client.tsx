"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDate } from "@/lib/utils";
import { Invoice, INVOICE_TYPE_NAMES, INVOICE_STATUS_NAMES, INVOICE_STATUS_COLORS } from "@/lib/types/invoice";
import {
  FileText,
  Search,
  Filter,
  Download,
  Eye,
  MoreVertical,
  FileDown,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  Mail,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";
import { SendEmailDialog } from "@/components/invoices/send-email-dialog";

interface InvoicesClientViewProps {
  initialInvoices: Invoice[];
}

/**
 * Client Component - Interactividad y filtros
 */
export function InvoicesClientView({ initialInvoices }: InvoicesClientViewProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [sendingEmailId, setSendingEmailId] = useState<number | null>(null);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const { toast } = useToast();

  // Filtrar facturas según los criterios
  const filteredInvoices = initialInvoices.filter((invoice) => {
    const matchesSearch =
      searchTerm === "" ||
      invoice.full_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (invoice.cliente_razon_social?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
      (invoice.cliente_numero_documento?.toLowerCase() || "").includes(searchTerm.toLowerCase());

    const matchesType =
      filterType === "all" || invoice.invoice_type === filterType;

    const matchesStatus =
      filterStatus === "all" || invoice.efact_status === filterStatus;

    return matchesSearch && matchesType && matchesStatus;
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "success":
        return <CheckCircle className="h-4 w-4" />;
      case "error":
        return <XCircle className="h-4 w-4" />;
      case "processing":
        return <Clock className="h-4 w-4 animate-spin" />;
      case "pending":
        return <AlertCircle className="h-4 w-4" />;
      default:
        return <AlertCircle className="h-4 w-4" />;
    }
  };

  const handleDownloadPDF = async (invoiceId: number) => {
    try {
      const response = await fetch(`/api/invoices/pdf/${invoiceId}`);
      if (!response.ok) throw new Error("Error al descargar PDF");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `factura-${invoiceId}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Error downloading PDF:", error);
    }
  };

  const handleDownloadXML = async (invoiceId: number) => {
    try {
      const response = await fetch(`/api/invoices/xml/${invoiceId}`);
      if (!response.ok) throw new Error("Error al descargar XML");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `factura-${invoiceId}.xml`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Error downloading XML:", error);
    }
  };

  const handleOpenEmailDialog = (invoice: Invoice) => {
    // Validar que tenga email
    if (!invoice.cliente_email) {
      toast({
        title: "Email no disponible",
        description: "Esta factura no tiene email de cliente registrado",
        variant: "destructive",
      });
      return;
    }

    // Validar estado
    if (invoice.efact_status !== "success") {
      toast({
        title: "Factura no válida",
        description: "Solo se pueden enviar facturas aceptadas por SUNAT",
        variant: "destructive",
      });
      return;
    }

    // Abrir dialog de confirmación
    setSelectedInvoice(invoice);
    setEmailDialogOpen(true);
  };

  const handleConfirmSendEmail = async (email: string, includeXml: boolean) => {
    if (!selectedInvoice) return;

    try {
      setSendingEmailId(selectedInvoice.id);

      const response = await fetch(`/api/invoices/send-email/${selectedInvoice.id}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          recipient_email: email,
          include_xml: includeXml,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({
          detail: "Error al enviar el email",
        }));
        throw new Error(error.detail || "Error al enviar el email");
      }

      const result = await response.json();

      toast({
        title: "Email enviado",
        description: `Comprobante enviado a ${result.sent_to}`,
      });

      // Cerrar dialog al éxito
      setEmailDialogOpen(false);
    } catch (error) {
      toast({
        title: "Error al enviar",
        description: error instanceof Error ? error.message : "No se pudo enviar el email",
        variant: "destructive",
      });
    } finally {
      setSendingEmailId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FileText className="h-6 w-6" />
            Comprobantes Electrónicos
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Gestiona facturas, boletas y comprobantes electrónicos
          </p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Buscar por serie, cliente, RUC/DNI..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger>
                <SelectValue placeholder="Tipo de comprobante" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los tipos</SelectItem>
                <SelectItem value="01">Factura</SelectItem>
                <SelectItem value="03">Boleta</SelectItem>
                <SelectItem value="07">Nota de Crédito</SelectItem>
                <SelectItem value="08">Nota de Débito</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                <SelectItem value="pending">Pendiente</SelectItem>
                <SelectItem value="processing">Procesando</SelectItem>
                <SelectItem value="success">Exitoso</SelectItem>
                <SelectItem value="error">Error</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Results Summary */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">
          Mostrando <span className="font-semibold">{filteredInvoices.length}</span> de{" "}
          <span className="font-semibold">{initialInvoices.length}</span> comprobantes
        </p>
      </div>

      {/* Invoices Table */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Comprobantes</CardTitle>
          <CardDescription>
            Comprobantes electrónicos generados desde órdenes
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Serie - Número</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Documento</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInvoices.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                      No se encontraron comprobantes
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredInvoices.map((invoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell className="font-mono font-medium">
                        {invoice.full_number}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {INVOICE_TYPE_NAMES[invoice.invoice_type]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {invoice.cliente_razon_social || <span className="text-gray-400">-</span>}
                      </TableCell>
                      <TableCell>
                        {invoice.cliente_numero_documento || <span className="text-gray-400">-</span>}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {invoice.currency} {invoice.total.toFixed(2)}
                      </TableCell>
                      <TableCell>
                        {formatDate(invoice.created_at)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={INVOICE_STATUS_COLORS[invoice.efact_status] || ""}
                        >
                          <span className="flex items-center gap-1">
                            {getStatusIcon(invoice.efact_status)}
                            {INVOICE_STATUS_NAMES[invoice.efact_status]}
                          </span>
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <Link href={`/dashboard/invoices/${invoice.id}`}>
                              <DropdownMenuItem>
                                <Eye className="h-4 w-4 mr-2" />
                                Ver detalles
                              </DropdownMenuItem>
                            </Link>
                            {invoice.efact_status === "success" && (
                              <>
                                {invoice.cliente_email && (
                                  <DropdownMenuItem
                                    onClick={() => handleOpenEmailDialog(invoice)}
                                    disabled={sendingEmailId === invoice.id}
                                  >
                                    <Mail className="h-4 w-4 mr-2" />
                                    Enviar por Email
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem
                                  onClick={() => handleDownloadPDF(invoice.id)}
                                >
                                  <FileDown className="h-4 w-4 mr-2" />
                                  Descargar PDF
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => handleDownloadXML(invoice.id)}
                                >
                                  <Download className="h-4 w-4 mr-2" />
                                  Descargar XML
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Dialog de confirmación de envío de email */}
      <SendEmailDialog
        open={emailDialogOpen}
        onOpenChange={setEmailDialogOpen}
        invoice={selectedInvoice}
        onConfirm={handleConfirmSendEmail}
        loading={sendingEmailId !== null}
      />
    </div>
  );
}

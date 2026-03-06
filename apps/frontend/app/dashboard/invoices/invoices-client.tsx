"use client";

import { useState, useMemo } from "react";
import { format } from "date-fns";
import type { DateRange } from "react-day-picker";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { formatDate } from "@/lib/utils";
import { Invoice, INVOICE_TYPE_NAMES, INVOICE_STATUS_NAMES, INVOICE_STATUS_COLORS } from "@/lib/types/invoice";
import {
  FileText,
  Search,
  Download,
  Eye,
  MoreVertical,
  FileDown,
  FileSpreadsheet,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  Mail,
  Loader2,
  Archive,
  X,
} from "lucide-react";
import Link from "next/link";
import { SendEmailDialog } from "@/components/invoices/send-email-dialog";
import {
  downloadInvoicePdf,
  downloadInvoiceXml,
  downloadInvoiceCdr,
  exportInvoices,
  bulkDownloadInvoices,
} from "@/lib/api-client/invoices";
import { useToast } from "@/hooks/use-toast";

interface InvoicesClientViewProps {
  initialInvoices: Invoice[];
}

/**
 * Client Component - Interactividad, filtros, selección múltiple y descargas
 */
export function InvoicesClientView({ initialInvoices }: InvoicesClientViewProps) {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [sendingEmailId, setSendingEmailId] = useState<number | null>(null);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [isExporting, setIsExporting] = useState(false);
  const [isBulkDownloading, setIsBulkDownloading] = useState(false);

  // Filtrar facturas según los criterios
  const filteredInvoices = useMemo(() => {
    return initialInvoices.filter((invoice) => {
      const matchesSearch =
        searchTerm === "" ||
        invoice.full_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (invoice.cliente_razon_social?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
        (invoice.cliente_numero_documento?.toLowerCase() || "").includes(searchTerm.toLowerCase());

      const matchesType =
        filterType === "all" || invoice.invoice_type === filterType;

      const matchesStatus =
        filterStatus === "all" || invoice.efact_status === filterStatus;

      let matchesDate = true;
      if (dateRange?.from) {
        const invoiceDate = new Date(invoice.created_at + "Z");
        if (invoiceDate < dateRange.from) matchesDate = false;
        if (dateRange.to) {
          const endOfDay = new Date(dateRange.to);
          endOfDay.setHours(23, 59, 59, 999);
          if (invoiceDate > endOfDay) matchesDate = false;
        }
      }

      return matchesSearch && matchesType && matchesStatus && matchesDate;
    });
  }, [initialInvoices, searchTerm, filterType, filterStatus, dateRange]);

  // Only success invoices can be selected for bulk download
  const selectableInvoices = filteredInvoices.filter(
    (inv) => inv.efact_status === "success"
  );

  const allSelectableSelected =
    selectableInvoices.length > 0 &&
    selectableInvoices.every((inv) => selectedIds.has(inv.id));

  const toggleSelection = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (allSelectableSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(selectableInvoices.map((inv) => inv.id)));
    }
  };

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

  const handleDownloadPDF = async (invoiceId: number, fullNumber: string) => {
    try {
      await downloadInvoicePdf(invoiceId, `${fullNumber}.pdf`);
      toast({ title: "PDF descargado", description: "El archivo se ha descargado correctamente" });
    } catch (error) {
      console.error("Error downloading PDF:", error);
      toast({ title: "Error", description: "Error al descargar el PDF", variant: "destructive" });
    }
  };

  const handleDownloadXML = async (invoiceId: number, fullNumber: string) => {
    try {
      await downloadInvoiceXml(invoiceId, `${fullNumber}.xml`);
      toast({ title: "XML descargado", description: "El archivo se ha descargado correctamente" });
    } catch (error) {
      console.error("Error downloading XML:", error);
      toast({ title: "Error", description: "Error al descargar el XML", variant: "destructive" });
    }
  };

  const handleDownloadCDR = async (invoiceId: number, fullNumber: string) => {
    try {
      await downloadInvoiceCdr(invoiceId, `${fullNumber}-CDR.json`);
      toast({ title: "CDR descargado", description: "El archivo se ha descargado correctamente" });
    } catch (error) {
      console.error("Error downloading CDR:", error);
      toast({ title: "Error", description: "Error al descargar el CDR", variant: "destructive" });
    }
  };

  const handleBulkDownload = async (fileType: "pdf" | "xml" | "cdr") => {
    if (selectedIds.size === 0) return;
    try {
      setIsBulkDownloading(true);
      await bulkDownloadInvoices(Array.from(selectedIds), fileType);
      toast({
        title: "Descarga completada",
        description: `Se descargaron ${selectedIds.size} archivos ${fileType.toUpperCase()}`,
      });
    } catch (error) {
      console.error("Error in bulk download:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Error en descarga masiva",
        variant: "destructive",
      });
    } finally {
      setIsBulkDownloading(false);
    }
  };

  const handleExport = async (fmt: "csv" | "excel") => {
    try {
      setIsExporting(true);
      await exportInvoices({
        format: fmt,
        start_date: dateRange?.from ? format(dateRange.from, "yyyy-MM-dd") : undefined,
        end_date: dateRange?.to ? format(dateRange.to, "yyyy-MM-dd") : undefined,
      });
    } catch (error) {
      console.error("Error exporting invoices:", error);
      toast({ title: "Error", description: "Error al exportar comprobantes", variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  };

  const handleOpenEmailDialog = (invoice: Invoice) => {
    if (!invoice.cliente_email) {
      toast({
        title: "Email no disponible",
        description: "Esta factura no tiene email de cliente registrado",
        variant: "destructive",
      });
      return;
    }
    if (invoice.efact_status !== "success") {
      toast({
        title: "Factura no válida",
        description: "Solo se pueden enviar facturas aceptadas por SUNAT",
        variant: "destructive",
      });
      return;
    }
    setSelectedInvoice(invoice);
    setEmailDialogOpen(true);
  };

  const handleConfirmSendEmail = async (email: string, includeXml: boolean) => {
    if (!selectedInvoice) return;

    try {
      setSendingEmailId(selectedInvoice.id);

      const response = await fetch(`/api/invoices/send-email/${selectedInvoice.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipient_email: email, include_xml: includeXml }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: "Error al enviar el email" }));
        throw new Error(error.detail || "Error al enviar el email");
      }

      const result = await response.json();
      toast({ title: "Email enviado", description: `Comprobante enviado a ${result.sent_to}` });
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
          <h1 className="text-2xl font-bold text-foreground font-heading flex items-center gap-2">
            <FileText className="h-6 w-6" />
            Comprobantes Electrónicos
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gestiona facturas, boletas y comprobantes electrónicos
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="gap-2" disabled={isExporting}>
              {isExporting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              Exportar
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => handleExport("csv")}>
              <FileText className="w-4 h-4 mr-2" />
              Descargar CSV
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleExport("excel")}>
              <FileSpreadsheet className="w-4 h-4 mr-2" />
              Descargar Excel
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-4 md:grid-cols-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por serie, cliente, RUC/DNI..."
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setSelectedIds(new Set()); }}
                className="pl-9"
              />
            </div>
            <Select value={filterType} onValueChange={(v) => { setFilterType(v); setSelectedIds(new Set()); }}>
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
            <Select value={filterStatus} onValueChange={(v) => { setFilterStatus(v); setSelectedIds(new Set()); }}>
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
            <DateRangePicker
              dateRange={dateRange}
              onDateRangeChange={(r) => { setDateRange(r); setSelectedIds(new Set()); }}
              placeholder="Rango de fechas"
            />
          </div>
        </CardContent>
      </Card>

      {/* Bulk Actions Bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 p-3 bg-muted/50 border rounded-lg">
          <span className="text-sm font-medium">
            {selectedIds.size} comprobante{selectedIds.size > 1 ? "s" : ""} seleccionado{selectedIds.size > 1 ? "s" : ""}
          </span>
          <div className="flex items-center gap-2 ml-auto">
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleBulkDownload("pdf")}
              disabled={isBulkDownloading}
            >
              {isBulkDownloading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <FileDown className="h-4 w-4 mr-1" />}
              PDF
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleBulkDownload("xml")}
              disabled={isBulkDownloading}
            >
              {isBulkDownloading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Download className="h-4 w-4 mr-1" />}
              XML
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleBulkDownload("cdr")}
              disabled={isBulkDownloading}
            >
              {isBulkDownloading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Archive className="h-4 w-4 mr-1" />}
              CDR
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSelectedIds(new Set())}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Results Summary */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
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
                  <TableHead className="w-[40px]">
                    <Checkbox
                      checked={allSelectableSelected && selectableInvoices.length > 0}
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
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
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      No se encontraron comprobantes
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredInvoices.map((invoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedIds.has(invoice.id)}
                          onCheckedChange={() => toggleSelection(invoice.id)}
                          disabled={invoice.efact_status !== "success"}
                        />
                      </TableCell>
                      <TableCell className="font-mono font-medium">
                        {invoice.full_number}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {INVOICE_TYPE_NAMES[invoice.invoice_type]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {invoice.cliente_razon_social || <span className="text-muted-foreground">-</span>}
                      </TableCell>
                      <TableCell>
                        {invoice.cliente_numero_documento || <span className="text-muted-foreground">-</span>}
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
                                  onClick={() => handleDownloadPDF(invoice.id, invoice.full_number)}
                                >
                                  <FileDown className="h-4 w-4 mr-2" />
                                  Descargar PDF
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => handleDownloadXML(invoice.id, invoice.full_number)}
                                >
                                  <Download className="h-4 w-4 mr-2" />
                                  Descargar XML
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => handleDownloadCDR(invoice.id, invoice.full_number)}
                                >
                                  <Archive className="h-4 w-4 mr-2" />
                                  Descargar CDR
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

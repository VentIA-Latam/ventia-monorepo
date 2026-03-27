"use client";

import { useState, useCallback } from "react";
import { useServerTable } from "@/lib/hooks/use-server-table";
import { Button } from "@/components/ui/button";
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
import { EmptyState } from "@/components/ui/empty-state";
import { formatDate } from "@/lib/utils";
import { Invoice, INVOICE_TYPE_NAMES, INVOICE_STATUS_NAMES, INVOICE_STATUS_COLORS } from "@/lib/types/invoice";
import {
  Search,
  Download,
  Plus,
  Eye,
  MoreVertical,
  FileDown,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  Mail,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";
import { SendEmailDialog } from "@/components/invoices/send-email-dialog";
import { downloadInvoicePdf, downloadInvoiceXml } from "@/lib/api-client/invoices";
import { useToast } from "@/hooks/use-toast";

const ITEMS_PER_PAGE = 10;

interface InvoicesClientViewProps {
  initialInvoices: Invoice[];
  initialTotal: number;
}

async function fetchInvoicesFromApi(
  params: Record<string, string>,
  signal: AbortSignal
): Promise<{ items: Invoice[]; total: number }> {
  const res = await fetch(`/api/invoices?${new URLSearchParams(params)}`, { signal });
  if (!res.ok) throw new Error("Failed to fetch invoices");
  return res.json();
}

export function InvoicesClientView({ initialInvoices, initialTotal }: InvoicesClientViewProps) {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [sendingEmailId, setSendingEmailId] = useState<number | null>(null);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  const { items: filteredInvoices, total, loading, isStale, fetchData, debouncedFetch } = useServerTable<Invoice>({
    initialItems: initialInvoices,
    initialTotal,
    fetchFn: fetchInvoicesFromApi,
  });

  const totalPages = Math.ceil(total / ITEMS_PER_PAGE);

  const buildParams = useCallback(
    (overrides: Record<string, string> = {}) => {
      const p: Record<string, string> = {
        skip: overrides.skip ?? String((currentPage - 1) * ITEMS_PER_PAGE),
        limit: overrides.limit ?? String(ITEMS_PER_PAGE),
      };
      const s = overrides.search ?? searchTerm;
      const t = overrides.invoice_type ?? (filterType !== "all" ? filterType : "");
      const st = overrides.efact_status ?? (filterStatus !== "all" ? filterStatus : "");
      if (s) p.search = s;
      if (t) p.invoice_type = t;
      if (st) p.efact_status = st;
      return p;
    },
    [currentPage, searchTerm, filterType, filterStatus]
  );

  const handleSearch = (value: string) => {
    setSearchTerm(value);
    setCurrentPage(1);
    debouncedFetch(buildParams({ search: value, skip: "0" }));
  };

  const handleFilterType = (value: string) => {
    setFilterType(value);
    setCurrentPage(1);
    fetchData(buildParams({ invoice_type: value !== "all" ? value : "", skip: "0" }));
  };

  const handleFilterStatus = (value: string) => {
    setFilterStatus(value);
    setCurrentPage(1);
    fetchData(buildParams({ efact_status: value !== "all" ? value : "", skip: "0" }));
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    fetchData(buildParams({ skip: String((page - 1) * ITEMS_PER_PAGE) }));
  };

  const handleClearFilters = () => {
    setSearchTerm("");
    setFilterType("all");
    setFilterStatus("all");
    setCurrentPage(1);
    fetchData({ skip: "0", limit: String(ITEMS_PER_PAGE) });
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
      toast({
        title: "PDF descargado",
        description: "El archivo se ha descargado correctamente",
      });
    } catch (error) {
      console.error("Error downloading PDF:", error);
      toast({
        title: "Error",
        description: "Error al descargar el PDF",
        variant: "destructive",
      });
    }
  };

  const handleDownloadXML = async (invoiceId: number, fullNumber: string) => {
    try {
      await downloadInvoiceXml(invoiceId, `${fullNumber}.xml`);
      toast({
        title: "XML descargado",
        description: "El archivo se ha descargado correctamente",
      });
    } catch (error) {
      console.error("Error downloading XML:", error);
      toast({
        title: "Error",
        description: "Error al descargar el XML",
        variant: "destructive",
      });
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
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold font-heading text-foreground">Comprobantes Electrónicos</h1>
            <p className="text-muted-foreground mt-1">
              Gestiona facturas, boletas y comprobantes electrónicos.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2" disabled>
              <Download className="w-4 h-4" />
              Exportar
            </Button>
            <Button className="gap-2" disabled>
              <Plus className="w-4 h-4" />
              Nueva Factura
            </Button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="flex-1 min-w-[250px] relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por serie, cliente, RUC/DNI..."
            value={searchTerm}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        <Select value={filterType} onValueChange={handleFilterType}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tipo</SelectItem>
            <SelectItem value="01">Factura</SelectItem>
            <SelectItem value="03">Boleta</SelectItem>
            <SelectItem value="07">Nota de Crédito</SelectItem>
            <SelectItem value="08">Nota de Débito</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filterStatus} onValueChange={handleFilterStatus}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Estado</SelectItem>
            <SelectItem value="pending">Pendiente</SelectItem>
            <SelectItem value="processing">Procesando</SelectItem>
            <SelectItem value="success">Exitoso</SelectItem>
            <SelectItem value="error">Error</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className={isStale ? "opacity-50 pointer-events-none transition-opacity" : "transition-opacity"}>
        {loading && !isStale ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">Cargando comprobantes...</span>
          </div>
        ) : filteredInvoices.length === 0 ? (
          <EmptyState
            icon={<Search className="h-6 w-6" />}
            title="No se encontraron comprobantes"
            description="Intenta ajustar los filtros de busqueda o tipo de comprobante."
            action={
              <Button variant="outline" size="sm" onClick={handleClearFilters}>
                Limpiar filtros
              </Button>
            }
          />
        ) : (
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
                {filteredInvoices.map((invoice) => (
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
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 ? (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Pagina {currentPage} de {totalPages} ({total} resultados)
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>

            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (currentPage <= 3) {
                pageNum = i + 1;
              } else if (currentPage >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = currentPage - 2 + i;
              }
              return (
                <Button
                  key={pageNum}
                  variant={currentPage === pageNum ? "default" : "outline"}
                  size="icon"
                  onClick={() => handlePageChange(pageNum)}
                >
                  {pageNum}
                </Button>
              );
            })}

            <Button
              variant="outline"
              size="icon"
              onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      ) : null}

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

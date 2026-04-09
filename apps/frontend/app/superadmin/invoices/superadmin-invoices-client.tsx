"use client";

import { useState, useEffect, useRef, useCallback } from "react";
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
import { useTenant } from "@/lib/context/tenant-context";
import { formatDate } from "@/lib/utils";
import type { Invoice } from "@/lib/types/invoice";
import { INVOICE_TYPE_NAMES, INVOICE_STATUS_NAMES, INVOICE_STATUS_COLORS } from "@/lib/types/invoice";
import { downloadInvoicePdf, downloadInvoiceXml } from "@/lib/api-client/invoices";
import { useToast } from "@/hooks/use-toast";
import {
  Search,
  Eye,
  MoreVertical,
  FileDown,
  Download,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";

interface SuperAdminInvoicesClientProps {
  initialInvoices: Invoice[];
  initialTotal: number;
}

export function SuperAdminInvoicesClient({
  initialInvoices,
  initialTotal,
}: SuperAdminInvoicesClientProps) {
  const ITEMS_PER_PAGE = 10;
  const { toast } = useToast();
  const { selectedTenantId, tenants } = useTenant();
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);

  const fetchInvoicesFromApi = useCallback(async (params: Record<string, string>, signal: AbortSignal) => {
    const res = await fetch(`/api/invoices?${new URLSearchParams(params)}`, { signal });
    if (!res.ok) throw new Error("Failed to fetch invoices");
    return res.json();
  }, []);

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
      if (selectedTenantId) p.tenant_id = String(selectedTenantId);
      const s = overrides.search ?? search;
      const t = overrides.invoice_type ?? (filterType !== "all" ? filterType : "");
      const st = overrides.efact_status ?? (filterStatus !== "all" ? filterStatus : "");
      if (s) p.search = s;
      if (t) p.invoice_type = t;
      if (st) p.efact_status = st;
      return p;
    },
    [currentPage, search, filterType, filterStatus, selectedTenantId]
  );

  const handleSearch = (value: string) => {
    setSearch(value);
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

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    fetchData(buildParams({ skip: String((newPage - 1) * ITEMS_PER_PAGE) }));
  };

  const prevTenantId = useRef(selectedTenantId);
  useEffect(() => {
    if (prevTenantId.current === selectedTenantId) return;
    prevTenantId.current = selectedTenantId;
    setCurrentPage(1);
    fetchData({ skip: "0", limit: String(ITEMS_PER_PAGE), ...(selectedTenantId ? { tenant_id: String(selectedTenantId) } : {}) });
  }, [selectedTenantId]);

  const tenantMap = new Map(tenants.map((t) => [t.id, t.name]));

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "success":
        return <CheckCircle className="h-4 w-4" />;
      case "error":
        return <XCircle className="h-4 w-4" />;
      case "processing":
        return <Clock className="h-4 w-4 animate-spin" />;
      default:
        return <AlertCircle className="h-4 w-4" />;
    }
  };

  const handleDownloadPDF = async (invoiceId: number, fullNumber: string) => {
    try {
      await downloadInvoicePdf(invoiceId, `${fullNumber}.pdf`);
      toast({ title: "PDF descargado", description: "El archivo se ha descargado correctamente" });
    } catch {
      toast({ title: "Error", description: "Error al descargar el PDF", variant: "destructive" });
    }
  };

  const handleDownloadXML = async (invoiceId: number, fullNumber: string) => {
    try {
      await downloadInvoiceXml(invoiceId, `${fullNumber}.xml`);
      toast({ title: "XML descargado", description: "El archivo se ha descargado correctamente" });
    } catch {
      toast({ title: "Error", description: "Error al descargar el XML", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por serie, cliente, RUC/DNI..."
            value={search}
            onChange={(e) => {
              handleSearch(e.target.value);
            }}
            className="pl-10"
          />
        </div>

        <Select value={filterType} onValueChange={handleFilterType}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los tipos</SelectItem>
            <SelectItem value="01">Factura</SelectItem>
            <SelectItem value="03">Boleta</SelectItem>
            <SelectItem value="07">Nota de Crédito</SelectItem>
            <SelectItem value="08">Nota de Débito</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filterStatus} onValueChange={handleFilterStatus}>
          <SelectTrigger className="w-full sm:w-[180px]">
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

      {/* Results count */}
      <p className="text-sm text-muted-foreground">
        Mostrando <span className="font-semibold">{filteredInvoices.length}</span> comprobantes
        {selectedTenantId !== null && tenantMap.has(selectedTenantId) ? (
          <> de <span className="font-semibold">{tenantMap.get(selectedTenantId)}</span></>
        ) : null}
      </p>

      {/* Table */}
      <div className={isStale ? "opacity-50 pointer-events-none transition-opacity" : "transition-opacity"}>
      {loading && !isStale ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Cargando comprobantes...</span>
        </div>
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Serie - Número</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Documento</TableHead>
                {selectedTenantId === null ? <TableHead>Empresa</TableHead> : null}
                <TableHead className="text-right">Monto</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredInvoices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={selectedTenantId ? 8 : 9} className="text-center py-8 text-muted-foreground">
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
                      {invoice.cliente_razon_social || <span className="text-muted-foreground">-</span>}
                    </TableCell>
                    <TableCell>
                      {invoice.cliente_numero_documento || <span className="text-muted-foreground">-</span>}
                    </TableCell>
                    {selectedTenantId === null ? (
                      <TableCell className="text-sm text-muted-foreground">
                        {tenantMap.get(invoice.tenant_id) || `Tenant ${invoice.tenant_id}`}
                      </TableCell>
                    ) : null}
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
                          <Link href={`/superadmin/invoices/${invoice.id}`}>
                            <DropdownMenuItem>
                              <Eye className="h-4 w-4 mr-2" />
                              Ver detalles
                            </DropdownMenuItem>
                          </Link>
                          {invoice.efact_status === "success" ? (
                            <>
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
                          ) : null}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      </div>

      {/* Pagination */}
      {totalPages > 1 ? (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Página {currentPage} de {totalPages} ({total} resultados)
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
    </div>
  );
}

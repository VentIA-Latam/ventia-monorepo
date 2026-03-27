"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useServerTable } from "@/lib/hooks/use-server-table";
import { useTenant } from "@/lib/context/tenant-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Settings, Plus, Edit2, Trash2, CheckCircle, XCircle, Search, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import {
  InvoiceSerie,
  INVOICE_TYPE_LABELS,
} from "@/lib/types/invoice";
import { CreateSerieDialog } from "@/components/superadmin/create-serie-dialog";
import { EditSerieDialog } from "@/components/superadmin/edit-serie-dialog";

interface InvoiceSeriesClientViewProps {
  initialSeries: InvoiceSerie[];
  initialTotal: number;
}

export function InvoiceSeriesClientView({ initialSeries, initialTotal }: InvoiceSeriesClientViewProps) {
  const ITEMS_PER_PAGE = 10;
  const { selectedTenantId, tenants } = useTenant();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedSerie, setSelectedSerie] = useState<InvoiceSerie | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchSeriesFromApi = useCallback(async (params: Record<string, string>, signal: AbortSignal) => {
    const res = await fetch(`/api/invoice-series?${new URLSearchParams(params)}`, { signal });
    if (!res.ok) throw new Error("Failed to fetch series");
    const data = await res.json();
    // Handle both array (legacy) and { items, total } response formats
    if (Array.isArray(data)) return { items: data, total: data.length };
    return data;
  }, []);

  const { items: filteredSeries, total, loading, isStale, fetchData, debouncedFetch } = useServerTable<InvoiceSerie>({
    initialItems: initialSeries,
    initialTotal,
    fetchFn: fetchSeriesFromApi,
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
      const st = overrides.is_active ?? (statusFilter === "active" ? "true" : statusFilter === "inactive" ? "false" : "");
      if (s) p.search = s;
      if (st) p.is_active = st;
      return p;
    },
    [currentPage, search, statusFilter, selectedTenantId]
  );

  const handleSearch = (value: string) => {
    setSearch(value);
    setCurrentPage(1);
    debouncedFetch(buildParams({ search: value, skip: "0" }));
  };

  const handleStatusFilter = (value: string) => {
    setStatusFilter(value);
    setCurrentPage(1);
    const isActive = value === "active" ? "true" : value === "inactive" ? "false" : "";
    fetchData(buildParams({ is_active: isActive, skip: "0" }));
  };

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    fetchData(buildParams({ skip: String((newPage - 1) * ITEMS_PER_PAGE) }));
  };

  // Tenant change — reset to page 1
  const prevTenantId = useRef(selectedTenantId);
  useEffect(() => {
    if (prevTenantId.current === selectedTenantId) return;
    prevTenantId.current = selectedTenantId;
    setCurrentPage(1);
    fetchData({ skip: "0", limit: String(ITEMS_PER_PAGE), ...(selectedTenantId ? { tenant_id: String(selectedTenantId) } : {}) });
  }, [selectedTenantId]);

  const refreshSeries = () => fetchData(buildParams());

  const getTenantName = (tenantId: number): string => {
    const tenant = tenants.find((t) => t.id === tenantId);
    return tenant ? tenant.name : `Tenant #${tenantId}`;
  };

  const handleDelete = async (serieId: number) => {
    if (!confirm("¿Estás seguro de eliminar esta serie? Esta acción no se puede deshacer.")) return;

    try {
      setError(null);
      const response = await fetch(`/api/invoice-series/${serieId}`, { method: "DELETE" });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Error al eliminar la serie");
      }
      await refreshSeries();
    } catch (err) {
      console.error("Error deleting serie:", err);
      setError(err instanceof Error ? err.message : "Error al eliminar la serie");
    }
  };

  const handleOpenEdit = (serie: InvoiceSerie) => {
    setSelectedSerie(serie);
    setIsEditDialogOpen(true);
  };

  const handleCreateSuccess = async () => {
    await refreshSeries();
    setIsCreateDialogOpen(false);
  };

  const handleEditSuccess = async () => {
    await refreshSeries();
    setIsEditDialogOpen(false);
    setSelectedSerie(null);
  };

  const handleEditClose = () => {
    setIsEditDialogOpen(false);
    setSelectedSerie(null);
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar por serie o descripcion..." value={search} onChange={(e) => handleSearch(e.target.value)} className="pl-10" />
        </div>
        <Select value={statusFilter} onValueChange={handleStatusFilter}>
          <SelectTrigger className="w-full sm:w-[160px]"><SelectValue placeholder="Estado" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="active">Activas</SelectItem>
            <SelectItem value="inactive">Inactivas</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nueva Serie
        </Button>
      </div>

      {/* Results count */}
      <p className="text-sm text-muted-foreground">
        Mostrando <span className="font-semibold">{filteredSeries.length}</span> series
      </p>

      {/* Error */}
      {error ? <p className="text-sm text-danger">{error}</p> : null}

      {/* Table */}
      <div className={isStale ? "opacity-50 pointer-events-none transition-opacity" : "transition-opacity"}>
      {loading && !isStale ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Cargando series...</span>
        </div>
      ) : filteredSeries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12">
          <Settings className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">No hay series configuradas</p>
        </div>
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {!selectedTenantId ? <TableHead>Empresa</TableHead> : null}
                <TableHead>Serie</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Descripcion</TableHead>
                <TableHead className="text-right">Ultimo Correlativo</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSeries.map((serie) => (
                <TableRow key={serie.id}>
                  {!selectedTenantId ? <TableCell>{getTenantName(serie.tenant_id)}</TableCell> : null}
                  <TableCell className="font-mono font-bold">{serie.serie}</TableCell>
                  <TableCell>{INVOICE_TYPE_LABELS[serie.invoice_type] || serie.invoice_type}</TableCell>
                  <TableCell className="max-w-[200px] truncate">
                    {serie.description || <span className="text-muted-foreground italic">Sin descripción</span>}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {String(serie.last_correlativo).padStart(8, '0')}
                  </TableCell>
                  <TableCell>
                    {serie.is_active ? (
                      <Badge className="bg-success-bg text-success border-success/30">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Activa
                      </Badge>
                    ) : (
                      <Badge className="bg-muted/50 text-foreground border-border">
                        <XCircle className="h-3 w-3 mr-1" />
                        Inactiva
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={() => handleOpenEdit(serie)} title="Editar serie">
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(serie.id)} className="text-danger hover:text-danger hover:bg-danger-bg" title="Eliminar serie">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
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
          <p className="text-sm text-muted-foreground">Página {currentPage} de {totalPages}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={currentPage === 1} onClick={() => handlePageChange(Math.max(1, currentPage - 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" disabled={currentPage === totalPages} onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : null}

      {/* Create Dialog */}
      <CreateSerieDialog
        open={isCreateDialogOpen}
        onClose={() => setIsCreateDialogOpen(false)}
        onSuccess={handleCreateSuccess}
        tenants={tenants}
      />

      {/* Edit Dialog */}
      <EditSerieDialog
        open={isEditDialogOpen}
        serie={selectedSerie}
        onClose={handleEditClose}
        onSuccess={handleEditSuccess}
      />
    </div>
  );
}

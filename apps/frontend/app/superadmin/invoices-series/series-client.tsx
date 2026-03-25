"use client";

import { useState, useEffect, useMemo } from "react";
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
// Alert removed — standard pattern
import { Settings, Plus, Edit2, Trash2, CheckCircle, XCircle, Search, ChevronLeft, ChevronRight } from "lucide-react";
import {
  InvoiceSerie,
  INVOICE_TYPE_LABELS,
} from "@/lib/types/invoice";
import { CreateSerieDialog } from "@/components/superadmin/create-serie-dialog";
import { EditSerieDialog } from "@/components/superadmin/edit-serie-dialog";

interface InvoiceSeriesClientViewProps {
  initialSeries: InvoiceSerie[];
}

export function InvoiceSeriesClientView({ initialSeries }: InvoiceSeriesClientViewProps) {
  const { selectedTenantId, tenants } = useTenant();
  const [series, setSeries] = useState<InvoiceSerie[]>(initialSeries);
  const [error, setError] = useState<string | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedSerie, setSelectedSerie] = useState<InvoiceSerie | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const filteredSeries = useMemo(() => series.filter((s) => {
    if (selectedTenantId && s.tenant_id !== selectedTenantId) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!s.serie?.toLowerCase().includes(q) && !s.description?.toLowerCase().includes(q)) return false;
    }
    if (statusFilter === "active" && !s.is_active) return false;
    if (statusFilter === "inactive" && s.is_active) return false;
    return true;
  }), [series, selectedTenantId, search, statusFilter]);

  const totalPages = Math.ceil(filteredSeries.length / itemsPerPage);
  const currentSeries = filteredSeries.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const getTenantName = (tenantId: number): string => {
    const tenant = tenants.find((t) => t.id === tenantId);
    return tenant ? tenant.name : `Tenant #${tenantId}`;
  };

  const loadSeries = async () => {
    try {
      const response = await fetch("/api/invoice-series");
      if (!response.ok) throw new Error("Error al cargar series");
      const data = await response.json();
      setSeries(data);
      setError(null);
    } catch (err) {
      console.error("Error loading series:", err);
      setError(err instanceof Error ? err.message : "Error al cargar las series");
    }
  };

  const handleDelete = async (serieId: number) => {
    if (!confirm("¿Estás seguro de eliminar esta serie? Esta acción no se puede deshacer.")) {
      return;
    }

    try {
      setError(null);
      const response = await fetch(`/api/invoice-series/${serieId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Error al eliminar la serie");
      }

      await loadSeries();
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
    await loadSeries();
    setIsCreateDialogOpen(false);
  };

  const handleEditSuccess = async () => {
    await loadSeries();
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
          <Input placeholder="Buscar por serie o descripcion..." value={search} onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }} className="pl-10" />
        </div>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setCurrentPage(1); }}>
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
      {currentSeries.length === 0 ? (
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
              {currentSeries.map((serie) => (
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
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenEdit(serie)}
                            title="Editar serie"
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(serie.id)}
                            className="text-danger hover:text-danger hover:bg-danger-bg"
                            title="Eliminar serie"
                          >
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

      {/* Pagination */}
      {totalPages > 1 ? (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Página {currentPage} de {totalPages}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={currentPage === 1} onClick={() => setCurrentPage((p) => p - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" disabled={currentPage === totalPages} onClick={() => setCurrentPage((p) => p + 1)}>
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


"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Settings, Plus, Edit2, Trash2, AlertCircle, CheckCircle, XCircle } from "lucide-react";
import {
  InvoiceSerie,
  INVOICE_TYPE_LABELS,
} from "@/lib/types/invoice";
import { Tenant } from "@/lib/types/tenant";
import { CreateSerieDialog } from "@/components/superadmin/create-serie-dialog";
import { EditSerieDialog } from "@/components/superadmin/edit-serie-dialog";

interface InvoiceSeriesClientViewProps {
  initialSeries: InvoiceSerie[];
}

export function InvoiceSeriesClientView({ initialSeries }: InvoiceSeriesClientViewProps) {
  const [series, setSeries] = useState<InvoiceSerie[]>(initialSeries);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedSerie, setSelectedSerie] = useState<InvoiceSerie | null>(null);

  useEffect(() => {
    fetchTenants();
  }, []);

  const fetchTenants = async () => {
    try {
      const response = await fetch("/api/superadmin/tenants?limit=100");
      if (response.ok) {
        const data = await response.json();
        setTenants(data.items || []);
      }
    } catch (error) {
      console.error("Error fetching tenants:", error);
    }
  };

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
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground font-heading flex items-center gap-2">
            <Settings className="h-6 w-6" />
            Series de Facturación
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configura las series de numeración para tus comprobantes electrónicos
          </p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nueva Serie
        </Button>
      </div>

      {/* Info Alert */}
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Las series de facturación son códigos de 4 caracteres que identifican cada tipo de comprobante. Ejemplos: F001 para facturas, B001 para boletas. El correlativo se incrementa automáticamente.
        </AlertDescription>
      </Alert>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Series List */}
      <Card>
        <CardHeader>
          <CardTitle>Series Configuradas</CardTitle>
          <CardDescription>
            Administra las series de numeración para cada tipo de comprobante
          </CardDescription>
        </CardHeader>
        <CardContent>
          {series.length === 0 ? (
            <div className="text-center py-12">
              <Settings className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground mb-4">No hay series configuradas</p>
              <Button onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Crear Primera Serie
              </Button>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tenant</TableHead>
                    <TableHead>Serie</TableHead>
                    <TableHead>Tipo de Comprobante</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead className="text-right">{"Último Correlativo"}</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {series.map((serie) => (
                    <TableRow key={serie.id}>
                      <TableCell className="font-medium text-sm">
                        {getTenantName(serie.tenant_id)}
                      </TableCell>
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
        </CardContent>
      </Card>

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


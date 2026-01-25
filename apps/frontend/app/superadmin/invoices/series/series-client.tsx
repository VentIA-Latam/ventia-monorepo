"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Settings, Plus, Edit2, Trash2, Loader2, AlertCircle, CheckCircle, XCircle } from "lucide-react";
import {
  InvoiceSerie,
  InvoiceSerieCreate,
  INVOICE_TYPES,
  INVOICE_TYPE_LABELS,
} from "@/lib/types/invoice";
import { Tenant } from "@/lib/types/tenant";

interface InvoiceSeriesClientViewProps {
  initialSeries: InvoiceSerie[];
}

interface InvoiceSerieFormData extends InvoiceSerieCreate {
  tenant_id?: number;
}

export function InvoiceSeriesClientView({ initialSeries }: InvoiceSeriesClientViewProps) {
  const [series, setSeries] = useState<InvoiceSerie[]>(initialSeries);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedSerie, setSelectedSerie] = useState<InvoiceSerie | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [formData, setFormData] = useState<InvoiceSerieFormData>({
    invoice_type: INVOICE_TYPES.FACTURA,
    serie: "",
    description: "",
    is_active: true,
    tenant_id: undefined,
  });

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

  const handleCreate = async () => {
    try {
      setIsSaving(true);
      setError(null);

      // Build URL with tenant_id query param if specified
      let url = "/api/invoice-series";
      if (formData.tenant_id) {
        url += `?tenant_id=${formData.tenant_id}`;
      }

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoice_type: formData.invoice_type,
          serie: formData.serie,
          description: formData.description,
          is_active: formData.is_active,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Error al crear la serie");
      }

      await loadSeries();
      setIsCreateDialogOpen(false);
      resetForm();
    } catch (err) {
      console.error("Error creating serie:", err);
      setError(err instanceof Error ? err.message : "Error al crear la serie");
    } finally {
      setIsSaving(false);
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
    setFormData({
      invoice_type: serie.invoice_type,
      serie: serie.serie,
      description: serie.description || "",
      is_active: serie.is_active,
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdate = async () => {
    if (!selectedSerie) return;

    try {
      setIsSaving(true);
      setError(null);

      const response = await fetch(`/api/invoice-series/${selectedSerie.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: formData.description || null,
          is_active: formData.is_active,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Error al actualizar la serie");
      }

      await loadSeries();
      setIsEditDialogOpen(false);
      setSelectedSerie(null);
      resetForm();
    } catch (err) {
      console.error("Error updating serie:", err);
      setError(err instanceof Error ? err.message : "Error al actualizar la serie");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCloseEditDialog = () => {
    setIsEditDialogOpen(false);
    setSelectedSerie(null);
    resetForm();
  };

  const resetForm = () => {
    setFormData({
      invoice_type: INVOICE_TYPES.FACTURA,
      serie: "",
      description: "",
      is_active: true,
      tenant_id: undefined,
    });
    setError(null);
  };

  const handleCloseCreateDialog = () => {
    setIsCreateDialogOpen(false);
    resetForm();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Settings className="h-6 w-6" />
            Series de Facturación
          </h1>
          <p className="text-sm text-gray-600 mt-1">
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
              <Settings className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 mb-4">No hay series configuradas</p>
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
                    <TableHead className="text-right">Último Correlativo</TableHead>
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
                        {serie.description || <span className="text-gray-400 italic">Sin descripción</span>}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {String(serie.last_correlativo).padStart(8, '0')}
                      </TableCell>
                      <TableCell>
                        {serie.is_active ? (
                          <Badge className="bg-green-50 text-green-700 border-green-200">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Activa
                          </Badge>
                        ) : (
                          <Badge className="bg-gray-50 text-gray-700 border-gray-200">
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
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
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
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Crear Nueva Serie</DialogTitle>
            <DialogDescription>
              Define una nueva serie de numeración para tus comprobantes electrónicos
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="tenant_id">Tenant</Label>
              <Select
                value={formData.tenant_id?.toString() || ""}
                onValueChange={(value) =>
                  setFormData({ ...formData, tenant_id: value ? parseInt(value) : undefined })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un tenant" />
                </SelectTrigger>
                <SelectContent>
                  {tenants.map((tenant) => (
                    <SelectItem key={tenant.id} value={tenant.id.toString()}>
                      {tenant.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">
                Selecciona el tenant para el cual se creará esta serie
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="invoice_type">Tipo de Comprobante</Label>
              <Select
                value={formData.invoice_type}
                onValueChange={(value) =>
                  setFormData({ ...formData, invoice_type: value as typeof formData.invoice_type })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona el tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={INVOICE_TYPES.FACTURA}>
                    Factura Electrónica
                  </SelectItem>
                  <SelectItem value={INVOICE_TYPES.BOLETA}>
                    Boleta de Venta Electrónica
                  </SelectItem>
                  <SelectItem value={INVOICE_TYPES.NOTA_CREDITO}>
                    Nota de Crédito Electrónica
                  </SelectItem>
                  <SelectItem value={INVOICE_TYPES.NOTA_DEBITO}>
                    Nota de Débito Electrónica
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="serie">Serie (4 caracteres)</Label>
              <Input
                id="serie"
                placeholder="Ej: F001, B001"
                value={formData.serie}
                onChange={(e) =>
                  setFormData({ ...formData, serie: e.target.value.toUpperCase() })
                }
                maxLength={4}
                className="font-mono"
              />
              <p className="text-xs text-gray-500">
                Usa 4 caracteres alfanuméricos (ej: F001 para facturas, B001 para boletas)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descripción (opcional)</Label>
              <Textarea
                id="description"
                placeholder="Ej: Serie principal de facturas"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseCreateDialog}>
              Cancelar
            </Button>
            <Button
              onClick={handleCreate}
              disabled={isSaving || !formData.serie || formData.serie.length !== 4 || !formData.tenant_id}
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creando...
                </>
              ) : (
                "Crear Serie"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Editar Serie</DialogTitle>
            <DialogDescription>
              Modifica la descripción o el estado de la serie {selectedSerie?.serie}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Tipo de Comprobante</Label>
              <Input
                value={INVOICE_TYPE_LABELS[formData.invoice_type] || formData.invoice_type}
                disabled
                className="bg-gray-50"
              />
            </div>

            <div className="space-y-2">
              <Label>Serie</Label>
              <Input
                value={formData.serie}
                disabled
                className="font-mono bg-gray-50"
              />
              <p className="text-xs text-gray-500">
                La serie no puede ser modificada una vez creada
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit_description">Descripción</Label>
              <Textarea
                id="edit_description"
                placeholder="Ej: Serie principal de facturas"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                rows={2}
              />
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="is_active"
                checked={formData.is_active}
                onChange={(e) =>
                  setFormData({ ...formData, is_active: e.target.checked })
                }
                className="h-4 w-4 rounded border-gray-300"
              />
              <Label htmlFor="is_active" className="text-sm font-normal">
                Serie activa (puede ser usada para emitir comprobantes)
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseEditDialog}>
              Cancelar
            </Button>
            <Button onClick={handleUpdate} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Guardando...
                </>
              ) : (
                "Guardar Cambios"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

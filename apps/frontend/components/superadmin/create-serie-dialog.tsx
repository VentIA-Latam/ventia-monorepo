"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import {
  InvoiceSerieCreate,
  INVOICE_TYPES,
} from "@/lib/types/invoice";
import { Tenant } from "@/lib/types/tenant";

interface InvoiceSerieFormData extends InvoiceSerieCreate {
  tenant_id?: number;
}

export interface CreateSerieDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  tenants: Tenant[];
}

export function CreateSerieDialog({ open, onClose, onSuccess, tenants }: CreateSerieDialogProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<InvoiceSerieFormData>({
    invoice_type: INVOICE_TYPES.FACTURA,
    serie: "",
    description: "",
    is_active: true,
    tenant_id: undefined,
    last_correlativo: 0,
  });

  const resetForm = () => {
    setFormData({
      invoice_type: INVOICE_TYPES.FACTURA,
      serie: "",
      description: "",
      is_active: true,
      tenant_id: undefined,
      last_correlativo: 0,
    });
    setError(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
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
          last_correlativo: formData.last_correlativo || 0,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Error al crear la serie");
      }

      resetForm();
      onSuccess();
    } catch (err) {
      console.error("Error creating serie:", err);
      setError(err instanceof Error ? err.message : "Error al crear la serie");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) handleClose(); }}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Crear Nueva Serie</DialogTitle>
          <DialogDescription>
            Define una nueva serie de numeraci\u00f3n para tus comprobantes electr\u00f3nicos
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
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
            <p className="text-xs text-muted-foreground">
              Selecciona el tenant para el cual se crear\u00e1 esta serie
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
                  Factura Electr\u00f3nica
                </SelectItem>
                <SelectItem value={INVOICE_TYPES.BOLETA}>
                  Boleta de Venta Electr\u00f3nica
                </SelectItem>
                <SelectItem value={INVOICE_TYPES.NOTA_CREDITO}>
                  Nota de Cr\u00e9dito Electr\u00f3nica
                </SelectItem>
                <SelectItem value={INVOICE_TYPES.NOTA_DEBITO}>
                  Nota de D\u00e9bito Electr\u00f3nica
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
            <p className="text-xs text-muted-foreground">
              Usa 4 caracteres alfanum\u00e9ricos (ej: F001 para facturas, B001 para boletas)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="last_correlativo">\u00daltimo Correlativo Usado</Label>
            <Input
              id="last_correlativo"
              type="number"
              placeholder="0"
              min="0"
              value={formData.last_correlativo || 0}
              onChange={(e) =>
                setFormData({ ...formData, last_correlativo: parseInt(e.target.value) || 0 })
              }
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">
              Si ya usaste esta serie antes, ingresa el \u00faltimo n\u00famero de comprobante. El pr\u00f3ximo ser\u00e1 este n\u00famero + 1.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descripci\u00f3n (opcional)</Label>
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
          <Button variant="outline" onClick={handleClose}>
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
  );
}

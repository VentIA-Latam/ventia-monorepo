"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  InvoiceSerie,
  INVOICE_TYPE_LABELS,
} from "@/lib/types/invoice";

export interface EditSerieDialogProps {
  open: boolean;
  serie: InvoiceSerie | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function EditSerieDialog({ open, serie, onClose, onSuccess }: EditSerieDialogProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    invoice_type: "",
    serie: "",
    description: "",
    is_active: true,
    last_correlativo: 0,
  });

  useEffect(() => {
    if (serie) {
      setFormData({
        invoice_type: serie.invoice_type,
        serie: serie.serie,
        description: serie.description || "",
        is_active: serie.is_active,
        last_correlativo: serie.last_correlativo || 0,
      });
    }
  }, [serie]);

  const resetForm = () => {
    setFormData({
      invoice_type: "",
      serie: "",
      description: "",
      is_active: true,
      last_correlativo: 0,
    });
    setError(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleUpdate = async () => {
    if (!serie) return;

    try {
      setIsSaving(true);
      setError(null);

      const response = await fetch(`/api/invoice-series/${serie.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: formData.description || null,
          is_active: formData.is_active,
          last_correlativo: formData.last_correlativo || 0,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Error al actualizar la serie");
      }

      resetForm();
      onSuccess();
    } catch (err) {
      console.error("Error updating serie:", err);
      setError(err instanceof Error ? err.message : "Error al actualizar la serie");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) handleClose(); }}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Editar Serie</DialogTitle>
          <DialogDescription>
            Modifica la descripción o el estado de la serie {serie?.serie}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
          <div className="space-y-2">
            <Label>Tipo de Comprobante</Label>
            <Input
              value={INVOICE_TYPE_LABELS[formData.invoice_type] || formData.invoice_type}
              disabled
              className="bg-muted/50"
            />
          </div>

          <div className="space-y-2">
            <Label>Serie</Label>
            <Input
              value={formData.serie}
              disabled
              className="font-mono bg-muted/50"
            />
            <p className="text-xs text-muted-foreground">
              La serie no puede ser modificada una vez creada
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit_last_correlativo">Último Correlativo Usado</Label>
            <Input
              id="edit_last_correlativo"
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
              ⚠️ Cuidado: el próximo comprobante será este número + 1. Úsalo solo si necesitas corregir el contador.
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
              className="h-4 w-4 rounded border-border"
            />
            <Label htmlFor="is_active" className="text-sm font-normal">
              Serie activa (puede ser usada para emitir comprobantes)
            </Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
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
  );
}

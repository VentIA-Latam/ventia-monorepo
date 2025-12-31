"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Tenant } from "@/lib/types/tenant";

interface EditTenantDialogProps {
  tenant: Tenant | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function EditTenantDialog({ tenant, open, onOpenChange, onSuccess }: EditTenantDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    shopify_store_url: "",
    shopify_access_token: "",
    shopify_api_version: "2024-01",
    is_active: true,
  });

  useEffect(() => {
    if (tenant) {
      setFormData({
        name: tenant.name,
        shopify_store_url: tenant.shopify_store_url || "",
        shopify_access_token: "",
        shopify_api_version: "2024-01",
        is_active: tenant.is_active,
      });
    }
  }, [tenant]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenant) return;

    setLoading(true);

    try {
      // Solo enviar campos que no estén vacíos
      const updateData: any = {
        name: formData.name,
        is_active: formData.is_active,
      };

      if (formData.shopify_store_url) {
        updateData.shopify_store_url = formData.shopify_store_url;
      }

      if (formData.shopify_access_token) {
        updateData.shopify_access_token = formData.shopify_access_token;
        updateData.shopify_api_version = formData.shopify_api_version;
      }

      const response = await fetch(`/api/superadmin/tenants/${tenant.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al actualizar tenant');
      }

      toast({
        title: "Tenant actualizado",
        description: "Los cambios se han guardado correctamente",
      });

      onSuccess();
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Error al actualizar tenant",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!tenant) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Editar Tenant</DialogTitle>
            <DialogDescription>
              Modifica la información del tenant {tenant.name}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-name">
                Nombre <span className="text-red-500">*</span>
              </Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>

            <div className="grid gap-2">
              <Label>Slug (no editable)</Label>
              <Input value={tenant.slug} disabled className="bg-gray-100" />
              <p className="text-xs text-gray-500">
                El slug no puede modificarse después de la creación
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="edit-shopify_store_url">
                URL de tienda Shopify
              </Label>
              <Input
                id="edit-shopify_store_url"
                type="url"
                placeholder="https://mi-tienda.myshopify.com"
                value={formData.shopify_store_url}
                onChange={(e) => setFormData({ ...formData, shopify_store_url: e.target.value })}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="edit-shopify_access_token">
                Nuevo Token de Shopify (opcional)
              </Label>
              <Input
                id="edit-shopify_access_token"
                type="password"
                placeholder="Dejar vacío para mantener el actual"
                value={formData.shopify_access_token}
                onChange={(e) => setFormData({ ...formData, shopify_access_token: e.target.value })}
              />
              <p className="text-xs text-gray-500">
                Solo completa si deseas cambiar el token actual
              </p>
            </div>

            {formData.shopify_access_token && (
              <div className="grid gap-2">
                <Label htmlFor="edit-shopify_api_version">
                  Versión API Shopify
                </Label>
                <Input
                  id="edit-shopify_api_version"
                  placeholder="2024-01"
                  value={formData.shopify_api_version}
                  onChange={(e) => setFormData({ ...formData, shopify_api_version: e.target.value })}
                />
              </div>
            )}

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="edit-is_active">Estado</Label>
                <p className="text-sm text-gray-500">
                  {formData.is_active ? "Tenant activo" : "Tenant inactivo"}
                </p>
              </div>
              <Switch
                id="edit-is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Guardar Cambios
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

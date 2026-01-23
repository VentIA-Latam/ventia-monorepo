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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Alert,
  AlertDescription,
} from "@/components/ui/alert";
import { Loader2, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Tenant, EcommercePlatform } from "@/lib/types/tenant";

interface EditTenantDialogProps {
  tenant: Tenant | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function EditTenantDialog({ tenant, open, onOpenChange, onSuccess }: EditTenantDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [platform, setPlatform] = useState<EcommercePlatform>(null);
  const [initialPlatform, setInitialPlatform] = useState<EcommercePlatform>(null);
  const [syncOnValidation, setSyncOnValidation] = useState(false);
  const [showPlatformWarning, setShowPlatformWarning] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    // Shopify fields
    shopify_store_url: "",
    shopify_access_token: "",
    shopify_api_version: "2024-01",
    // WooCommerce fields
    woocommerce_url: "",
    woocommerce_consumer_key: "",
    woocommerce_consumer_secret: "",
    is_active: true,
  });

  useEffect(() => {
    if (tenant) {
      // Determinar plataforma actual desde settings o legacy
      let currentPlatform: EcommercePlatform = null;
      let currentSyncOnValidation = false;
      let currentShopifyUrl = "";
      let currentWooCommerceUrl = "";

      // Priorizar settings sobre campos legacy
      if (tenant.settings?.ecommerce) {
        currentSyncOnValidation = tenant.settings.ecommerce.sync_on_validation;

        if (tenant.settings.ecommerce.shopify) {
          currentPlatform = "shopify";
          currentShopifyUrl = tenant.settings.ecommerce.shopify.store_url;
        } else if (tenant.settings.ecommerce.woocommerce) {
          currentPlatform = "woocommerce";
          currentWooCommerceUrl = tenant.settings.ecommerce.woocommerce.store_url;
        }
      } else if (tenant.shopify_store_url) {
        // Fallback a campo legacy
        currentPlatform = "shopify";
        currentShopifyUrl = tenant.shopify_store_url;
      }

      setPlatform(currentPlatform);
      setInitialPlatform(currentPlatform);
      setSyncOnValidation(currentSyncOnValidation);
      setShowPlatformWarning(false);

      setFormData({
        name: tenant.name,
        shopify_store_url: currentShopifyUrl,
        shopify_access_token: "",
        shopify_api_version: tenant.settings?.ecommerce?.shopify?.api_version || "2024-01",
        woocommerce_url: currentWooCommerceUrl,
        woocommerce_consumer_key: "",
        woocommerce_consumer_secret: "",
        is_active: tenant.is_active,
      });
    }
  }, [tenant]);

  const handlePlatformChange = (newPlatform: EcommercePlatform) => {
    if (initialPlatform && newPlatform !== initialPlatform) {
      setShowPlatformWarning(true);
    } else {
      setShowPlatformWarning(false);
    }
    setPlatform(newPlatform);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenant) return;

    setLoading(true);

    try {
      // Construir el objeto de actualización
      const updateData: any = {
        name: formData.name,
        is_active: formData.is_active,
      };

      // Construir settings de e-commerce si hay una plataforma seleccionada
      if (platform) {
        updateData.settings = {
          ecommerce: {
            sync_on_validation: syncOnValidation,
          },
        };

        if (platform === "shopify") {
          updateData.settings.ecommerce.shopify = {
            store_url: formData.shopify_store_url,
            api_version: formData.shopify_api_version,
          };

          // Solo incluir access_token si se proporcionó (para actualizar)
          if (formData.shopify_access_token) {
            updateData.shopify_access_token = formData.shopify_access_token;
          }

          // Limpiar WooCommerce si se cambió de plataforma
          if (initialPlatform === "woocommerce") {
            updateData.settings.ecommerce.woocommerce = null;
          }
        } else if (platform === "woocommerce") {
          updateData.settings.ecommerce.woocommerce = {
            store_url: formData.woocommerce_url,
          };

          // Solo incluir credenciales si se proporcionaron (para actualizar)
          if (formData.woocommerce_consumer_key && formData.woocommerce_consumer_secret) {
            updateData.woocommerce_consumer_key = formData.woocommerce_consumer_key;
            updateData.woocommerce_consumer_secret = formData.woocommerce_consumer_secret;
          }

          // Limpiar Shopify si se cambió de plataforma
          if (initialPlatform === "shopify") {
            updateData.settings.ecommerce.shopify = null;
            updateData.shopify_access_token = null;
          }
        }
      } else {
        // Sin plataforma - limpiar toda la configuración de e-commerce
        updateData.settings = {
          ecommerce: null,
        };
        updateData.shopify_access_token = null;
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
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
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

            {/* Selección de Plataforma */}
            <div className="grid gap-2">
              <Label htmlFor="platform">
                Plataforma de E-commerce
              </Label>
              <Select
                value={platform || "none"}
                onValueChange={(value) => handlePlatformChange(value === "none" ? null : value as EcommercePlatform)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sin plataforma de e-commerce" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin plataforma de e-commerce</SelectItem>
                  <SelectItem value="shopify">Shopify</SelectItem>
                  <SelectItem value="woocommerce">WooCommerce</SelectItem>
                </SelectContent>
              </Select>
              {initialPlatform && (
                <p className="text-xs text-gray-500">
                  Plataforma actual: <span className="font-medium capitalize">{initialPlatform}</span>
                </p>
              )}
            </div>

            {/* Advertencia de cambio de plataforma */}
            {showPlatformWarning && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Al cambiar de plataforma se perderán las credenciales anteriores. Deberás proporcionar nuevas credenciales.
                </AlertDescription>
              </Alert>
            )}

            {/* Toggle de sincronización - solo si hay plataforma */}
            {platform && (
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label htmlFor="sync-on-validation">Sincronizar al validar pago</Label>
                  <p className="text-sm text-gray-500">
                    Sincronizar automáticamente pedidos al validar pagos
                  </p>
                </div>
                <Switch
                  id="sync-on-validation"
                  checked={syncOnValidation}
                  onCheckedChange={setSyncOnValidation}
                />
              </div>
            )}

            {/* Campos de Shopify */}
            {platform === "shopify" && (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="edit-shopify_store_url">
                    URL de tienda Shopify <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="edit-shopify_store_url"
                    type="url"
                    placeholder="https://mi-tienda.myshopify.com"
                    value={formData.shopify_store_url}
                    onChange={(e) => setFormData({ ...formData, shopify_store_url: e.target.value })}
                    required
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="edit-shopify_access_token">
                    Token de acceso Shopify {showPlatformWarning ? <span className="text-red-500">*</span> : "(opcional)"}
                  </Label>
                  <Input
                    id="edit-shopify_access_token"
                    type="password"
                    placeholder={showPlatformWarning ? "Requerido al cambiar de plataforma" : "Dejar vacío para mantener el actual"}
                    value={formData.shopify_access_token}
                    onChange={(e) => setFormData({ ...formData, shopify_access_token: e.target.value })}
                    required={showPlatformWarning && initialPlatform !== "shopify"}
                  />
                  <p className="text-xs text-gray-500">
                    {showPlatformWarning
                      ? "Debes proporcionar un nuevo token al cambiar de plataforma"
                      : "Solo completa si deseas cambiar el token actual"
                    }
                  </p>
                </div>

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
              </>
            )}

            {/* Campos de WooCommerce */}
            {platform === "woocommerce" && (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="edit-woocommerce_url">
                    URL de WooCommerce <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="edit-woocommerce_url"
                    type="url"
                    placeholder="https://mi-tienda.com"
                    value={formData.woocommerce_url}
                    onChange={(e) => setFormData({ ...formData, woocommerce_url: e.target.value })}
                    required
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="edit-woocommerce_consumer_key">
                    Consumer Key {showPlatformWarning ? <span className="text-red-500">*</span> : "(opcional)"}
                  </Label>
                  <Input
                    id="edit-woocommerce_consumer_key"
                    type="password"
                    placeholder={showPlatformWarning ? "Requerido al cambiar de plataforma" : "Dejar vacío para mantener el actual"}
                    value={formData.woocommerce_consumer_key}
                    onChange={(e) => setFormData({ ...formData, woocommerce_consumer_key: e.target.value })}
                    required={showPlatformWarning && initialPlatform !== "woocommerce"}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="edit-woocommerce_consumer_secret">
                    Consumer Secret {showPlatformWarning ? <span className="text-red-500">*</span> : "(opcional)"}
                  </Label>
                  <Input
                    id="edit-woocommerce_consumer_secret"
                    type="password"
                    placeholder={showPlatformWarning ? "Requerido al cambiar de plataforma" : "Dejar vacío para mantener el actual"}
                    value={formData.woocommerce_consumer_secret}
                    onChange={(e) => setFormData({ ...formData, woocommerce_consumer_secret: e.target.value })}
                    required={showPlatformWarning && initialPlatform !== "woocommerce"}
                  />
                  <p className="text-xs text-gray-500">
                    {showPlatformWarning
                      ? "Debes proporcionar nuevas credenciales al cambiar de plataforma"
                      : "Solo completa si deseas cambiar las credenciales actuales"
                    }
                  </p>
                </div>
              </>
            )}

            {/* Estado del tenant */}
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label htmlFor="edit-is_active">Estado del Tenant</Label>
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

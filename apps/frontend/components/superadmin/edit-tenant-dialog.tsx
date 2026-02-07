"use client";

import { useState, useEffect } from "react";
import { updateTenant } from "@/lib/api-client";
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
  Alert,
  AlertDescription,
} from "@/components/ui/alert";
import { Loader2, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Tenant, EcommercePlatform } from "@/lib/types/tenant";
import {
  PlatformSelector,
  ShopifyFields,
  WooCommerceFields,
  EmissorLocationForm,
} from "./tenant-forms";

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
    efact_ruc: "",
    // Nuevos campos - Datos de emisor
    emisor_nombre_comercial: "",
    emisor_ubigeo: "",
    emisor_departamento: "",
    emisor_provincia: "",
    emisor_distrito: "",
    emisor_direccion: "",
    // Shopify fields
    shopify_store_url: "",
    shopify_client_id: "",
    shopify_client_secret: "",
    shopify_api_version: "2025-10",
    // WooCommerce fields
    woocommerce_url: "",
    woocommerce_consumer_key: "",
    woocommerce_consumer_secret: "",
    is_active: true,
  });

  useEffect(() => {
    if (tenant) {
      // Determinar plataforma actual desde ecommerce_settings
      let currentPlatform: EcommercePlatform = null;
      let currentSyncOnValidation = false;
      let currentStoreUrl = "";

      if (tenant.ecommerce_settings) {
        currentPlatform = tenant.ecommerce_settings.platform;
        currentSyncOnValidation = tenant.ecommerce_settings.sync_on_validation;
        currentStoreUrl = tenant.ecommerce_settings.store_url || "";
      }

      setPlatform(currentPlatform);
      setInitialPlatform(currentPlatform);
      setSyncOnValidation(currentSyncOnValidation);
      setShowPlatformWarning(false);

      setFormData({
        name: tenant.name,
        efact_ruc: tenant.efact_ruc || "",
        emisor_nombre_comercial: tenant.emisor_nombre_comercial || "",
        emisor_ubigeo: tenant.emisor_ubigeo || "",
        emisor_departamento: tenant.emisor_departamento || "",
        emisor_provincia: tenant.emisor_provincia || "",
        emisor_distrito: tenant.emisor_distrito || "",
        emisor_direccion: tenant.emisor_direccion || "",
        shopify_store_url: currentPlatform === "shopify" ? currentStoreUrl : "",
        shopify_client_id: "",
        shopify_client_secret: "",
        shopify_api_version: "2025-10",
        woocommerce_url: currentPlatform === "woocommerce" ? currentStoreUrl : "",
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
        efact_ruc: formData.efact_ruc || undefined,
        emisor_nombre_comercial: formData.emisor_nombre_comercial || undefined,
        emisor_ubigeo: formData.emisor_ubigeo || undefined,
        emisor_departamento: formData.emisor_departamento || undefined,
        emisor_provincia: formData.emisor_provincia || undefined,
        emisor_distrito: formData.emisor_distrito || undefined,
        emisor_direccion: formData.emisor_direccion || undefined,
      };

      // Configurar plataforma y sync
      if (platform) {
        updateData.ecommerce_platform = platform;
        updateData.sync_on_validation = syncOnValidation;

        if (platform === "shopify") {
          updateData.ecommerce_store_url = formData.shopify_store_url;
          updateData.shopify_api_version = formData.shopify_api_version;

          // Solo incluir credenciales OAuth2 si se proporcionaron (para actualizar)
          if (formData.shopify_client_id && formData.shopify_client_secret) {
            updateData.shopify_client_id = formData.shopify_client_id;
            updateData.shopify_client_secret = formData.shopify_client_secret;
          }

        } else if (platform === "woocommerce") {
          updateData.ecommerce_store_url = formData.woocommerce_url;

          // Solo incluir credenciales si se proporcionaron (para actualizar)
          if (formData.woocommerce_consumer_key && formData.woocommerce_consumer_secret) {
            updateData.ecommerce_consumer_key = formData.woocommerce_consumer_key;
            updateData.ecommerce_consumer_secret = formData.woocommerce_consumer_secret;
          }

        }
      } else {
        // Sin plataforma
        updateData.ecommerce_platform = null;
      }

      // ✅ Usa Client API Layer
      await updateTenant(tenant.id, updateData);

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
                Nombre <span className="text-danger">*</span>
              </Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="edit-efact_ruc">
                RUC (Facturación Electrónica)
              </Label>
              <Input
                id="edit-efact_ruc"
                placeholder="12345678901 (11 dígitos)"
                value={formData.efact_ruc}
                onChange={(e) => setFormData({ ...formData, efact_ruc: e.target.value })}
                pattern="^\d{11}$"
                maxLength={11}
              />
              <p className="text-xs text-muted-foreground">
                RUC del tenant para facturación electrónica en Perú (opcional, debe tener 11 dígitos)
              </p>
            </div>

            {/* Nombre Comercial */}
            <div className="grid gap-2">
              <Label htmlFor="edit-emisor_nombre_comercial">Nombre Comercial del Emisor</Label>
              <Input
                id="edit-emisor_nombre_comercial"
                value={formData.emisor_nombre_comercial}
                onChange={(e) => setFormData({ ...formData, emisor_nombre_comercial: e.target.value })}
                placeholder="Ej: Tienda Example S.A.C."
              />
              <p className="text-xs text-muted-foreground">
                RUC del tenant para facturación electrónica en Perú (opcional, debe tener 11 dígitos)
              </p>
            </div>

            {/* Sección: Ubicación Fiscal */}
            <div className="rounded-lg border p-4 space-y-4 bg-muted/50">
              <h3 className="font-semibold text-sm">Ubicación Fiscal (Emisor)</h3>
              <EmissorLocationForm
                values={{
                  emisor_ubigeo: formData.emisor_ubigeo,
                  emisor_departamento: formData.emisor_departamento,
                  emisor_provincia: formData.emisor_provincia,
                  emisor_distrito: formData.emisor_distrito,
                  emisor_direccion: formData.emisor_direccion,
                }}
                onChange={(vals) => setFormData({ ...formData, ...vals })}
                idPrefix="edit"
                fieldSpacing="grid gap-2"
                gridGap="gap-3"
              />
            </div>

            <div className="grid gap-2">
              <Label>Slug (no editable)</Label>
              <Input value={tenant.slug} disabled className="bg-muted" />
              <p className="text-xs text-muted-foreground">
                El slug no puede modificarse después de la creación
              </p>
            </div>

            {/* Selección de Plataforma */}
            <div className="grid gap-3">
              <div className="flex items-center justify-between">
                <Label>Plataforma de E-commerce</Label>
                {initialPlatform && (
                  <span className="text-xs text-muted-foreground">
                    Configurado: <span className="font-medium capitalize">{initialPlatform}</span>
                  </span>
                )}
              </div>

              <PlatformSelector
                selectedPlatform={platform}
                onPlatformChange={handlePlatformChange}
                initialPlatform={initialPlatform}
              />
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
                  <p className="text-sm text-muted-foreground">
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
              <ShopifyFields
                values={{
                  shopify_store_url: formData.shopify_store_url,
                  shopify_client_id: formData.shopify_client_id,
                  shopify_client_secret: formData.shopify_client_secret,
                  shopify_api_version: formData.shopify_api_version,
                }}
                onChange={(vals) => setFormData({ ...formData, ...vals })}
                idPrefix="edit"
                credentialsOptional={true}
                showPlatformWarning={showPlatformWarning}
              />
            )}

            {/* Campos de WooCommerce */}
            {platform === "woocommerce" && (
              <WooCommerceFields
                values={{
                  woocommerce_url: formData.woocommerce_url,
                  woocommerce_consumer_key: formData.woocommerce_consumer_key,
                  woocommerce_consumer_secret: formData.woocommerce_consumer_secret,
                }}
                onChange={(vals) => setFormData({ ...formData, ...vals })}
                idPrefix="edit"
                credentialsOptional={true}
                showPlatformWarning={showPlatformWarning}
              />
            )}

            {/* Estado del tenant */}
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label htmlFor="edit-is_active">Estado del Tenant</Label>
                <p className="text-sm text-muted-foreground">
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

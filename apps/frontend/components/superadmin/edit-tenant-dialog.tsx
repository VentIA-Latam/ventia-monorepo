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
import { cn } from "@/lib/utils";
import Image from "next/image";
import {
  Alert,
  AlertDescription,
} from "@/components/ui/alert";
import { Loader2, AlertTriangle, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Tenant, EcommercePlatform } from "@/lib/types/tenant";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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
            updateData.woocommerce_consumer_key = formData.woocommerce_consumer_key;
            updateData.woocommerce_consumer_secret = formData.woocommerce_consumer_secret;
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
              <p className="text-xs text-gray-500">
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
              <p className="text-xs text-gray-500">
                RUC del tenant para facturación electrónica en Perú (opcional, debe tener 11 dígitos)
              </p>
            </div>

            {/* Sección: Ubicación Fiscal */}
            <div className="rounded-lg border p-4 space-y-4 bg-gray-50">
              <h3 className="font-semibold text-sm">Ubicación Fiscal (Emisor)</h3>

              {/* UBIGEO */}
              <div className="grid gap-2">
                <Label htmlFor="edit-emisor_ubigeo" className="flex items-center gap-2">
                  Código UBIGEO
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="inline-block w-4 h-4 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Código UBIGEO de 6 dígitos según INEI (Ej: 150101 para Lima)</p>
                    </TooltipContent>
                  </Tooltip>
                </Label>
                <Input
                  id="edit-emisor_ubigeo"
                  value={formData.emisor_ubigeo}
                  onChange={(e) => setFormData({ ...formData, emisor_ubigeo: e.target.value })}
                  placeholder="150101"
                  maxLength={6}
                />
              </div>

              {/* Grid 3 columnas: Departamento, Provincia, Distrito */}
              <div className="grid grid-cols-3 gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="edit-emisor_departamento">Departamento</Label>
                  <Input
                    id="edit-emisor_departamento"
                    value={formData.emisor_departamento}
                    onChange={(e) => setFormData({ ...formData, emisor_departamento: e.target.value })}
                    placeholder="LIMA"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="edit-emisor_provincia">Provincia</Label>
                  <Input
                    id="edit-emisor_provincia"
                    value={formData.emisor_provincia}
                    onChange={(e) => setFormData({ ...formData, emisor_provincia: e.target.value })}
                    placeholder="LIMA"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="edit-emisor_distrito">Distrito</Label>
                  <Input
                    id="edit-emisor_distrito"
                    value={formData.emisor_distrito}
                    onChange={(e) => setFormData({ ...formData, emisor_distrito: e.target.value })}
                    placeholder="LIMA"
                  />
                </div>
              </div>

              {/* Dirección */}
              <div className="grid gap-2">
                <Label htmlFor="edit-emisor_direccion">Dirección Fiscal</Label>
                <Input
                  id="edit-emisor_direccion"
                  value={formData.emisor_direccion}
                  onChange={(e) => setFormData({ ...formData, emisor_direccion: e.target.value })}
                  placeholder="Av. Ejemplo 123, Lima, Perú"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Slug (no editable)</Label>
              <Input value={tenant.slug} disabled className="bg-gray-100" />
              <p className="text-xs text-gray-500">
                El slug no puede modificarse después de la creación
              </p>
            </div>

            {/* Selección de Plataforma */}
            <div className="grid gap-3">
              <div className="flex items-center justify-between">
                <Label>Plataforma de E-commerce</Label>
                {initialPlatform && (
                  <span className="text-xs text-gray-500">
                    Configurado: <span className="font-medium capitalize">{initialPlatform}</span>
                  </span>
                )}
              </div>

              <div className="grid grid-cols-3 gap-3">
                {/* Sin Plataforma */}
                <button
                  type="button"
                  onClick={() => handlePlatformChange(null)}
                  className={cn(
                    "relative flex flex-col items-center justify-center p-4 rounded-lg border-2 transition-all hover:shadow-md",
                    platform === null
                      ? "border-gray-500 bg-gray-50 shadow-md"
                      : "border-gray-200 bg-white hover:border-gray-300"
                  )}
                >
                  <div className="w-12 h-12 mb-2 flex items-center justify-center text-gray-400">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                  <span className={cn(
                    "font-medium text-xs",
                    platform === null ? "text-gray-700" : "text-gray-500"
                  )}>
                    Ninguna
                  </span>
                  {platform === null && (
                    <div className="absolute top-2 right-2">
                      <div className="bg-gray-500 text-white rounded-full w-5 h-5 flex items-center justify-center">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                    </div>
                  )}
                </button>

                {/* Shopify Card */}
                <button
                  type="button"
                  onClick={() => handlePlatformChange("shopify")}
                  className={cn(
                    "relative flex flex-col items-center justify-center p-4 rounded-lg border-2 transition-all hover:shadow-md",
                    platform === "shopify"
                      ? "border-green-500 bg-green-50 shadow-md ring-2 ring-green-200"
                      : "border-gray-200 bg-white hover:border-gray-300",
                    initialPlatform === "shopify" && platform === "shopify" && "animate-pulse"
                  )}
                >
                  <div className="relative w-12 h-12 mb-2">
                    <Image
                      src="/external-icons/shopify-icon.png"
                      alt="Shopify"
                      fill
                      className="object-contain"
                    />
                  </div>
                  <span className={cn(
                    "font-medium text-xs",
                    platform === "shopify" ? "text-green-700" : "text-gray-600"
                  )}>
                    Shopify
                  </span>
                  {platform === "shopify" && (
                    <div className="absolute top-2 right-2">
                      <div className="bg-green-500 text-white rounded-full w-5 h-5 flex items-center justify-center">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                    </div>
                  )}
                  {initialPlatform === "shopify" && (
                    <div className="absolute -top-1 -left-1">
                      <div className="bg-blue-500 text-white text-[10px] px-1.5 py-0.5 rounded font-medium">
                        Actual
                      </div>
                    </div>
                  )}
                </button>

                {/* WooCommerce Card */}
                <button
                  type="button"
                  onClick={() => handlePlatformChange("woocommerce")}
                  className={cn(
                    "relative flex flex-col items-center justify-center p-4 rounded-lg border-2 transition-all hover:shadow-md",
                    platform === "woocommerce"
                      ? "border-purple-500 bg-purple-50 shadow-md ring-2 ring-purple-200"
                      : "border-gray-200 bg-white hover:border-gray-300",
                    initialPlatform === "woocommerce" && platform === "woocommerce" && "animate-pulse"
                  )}
                >
                  <div className="relative w-12 h-12 mb-2">
                    <Image
                      src="/external-icons/woo-icon.png"
                      alt="WooCommerce"
                      fill
                      className="object-contain"
                    />
                  </div>
                  <span className={cn(
                    "font-medium text-xs",
                    platform === "woocommerce" ? "text-purple-700" : "text-gray-600"
                  )}>
                    WooCommerce
                  </span>
                  {platform === "woocommerce" && (
                    <div className="absolute top-2 right-2">
                      <div className="bg-purple-500 text-white rounded-full w-5 h-5 flex items-center justify-center">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                    </div>
                  )}
                  {initialPlatform === "woocommerce" && (
                    <div className="absolute -top-1 -left-1">
                      <div className="bg-blue-500 text-white text-[10px] px-1.5 py-0.5 rounded font-medium">
                        Actual
                      </div>
                    </div>
                  )}
                </button>
              </div>
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
                  <Label htmlFor="edit-shopify_client_id" className="flex items-center gap-2">
                    Client ID de Shopify {showPlatformWarning ? <span className="text-red-500">*</span> : "(opcional)"}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-4 w-4 text-gray-400 cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>Obtén el Client ID desde el panel de tu app de Shopify en Partners Dashboard</p>
                      </TooltipContent>
                    </Tooltip>
                  </Label>
                  <Input
                    id="edit-shopify_client_id"
                    type="text"
                    placeholder={showPlatformWarning ? "Requerido al cambiar de plataforma" : "Dejar vacío para mantener el actual"}
                    value={formData.shopify_client_id}
                    onChange={(e) => setFormData({ ...formData, shopify_client_id: e.target.value })}
                    required={showPlatformWarning && initialPlatform !== "shopify"}
                  />
                  <p className="text-xs text-gray-500">
                    {showPlatformWarning
                      ? "Debes proporcionar un nuevo Client ID al cambiar de plataforma"
                      : "Solo completa si deseas cambiar las credenciales OAuth2"
                    }
                  </p>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="edit-shopify_client_secret" className="flex items-center gap-2">
                    Client Secret de Shopify {showPlatformWarning ? <span className="text-red-500">*</span> : "(opcional)"}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-4 w-4 text-gray-400 cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>Obtén el Client Secret desde el panel de tu app de Shopify en Partners Dashboard</p>
                      </TooltipContent>
                    </Tooltip>
                  </Label>
                  <Input
                    id="edit-shopify_client_secret"
                    type="password"
                    placeholder={showPlatformWarning ? "Requerido al cambiar de plataforma" : "Dejar vacío para mantener el actual"}
                    value={formData.shopify_client_secret}
                    onChange={(e) => setFormData({ ...formData, shopify_client_secret: e.target.value })}
                    required={showPlatformWarning && initialPlatform !== "shopify"}
                  />
                  <p className="text-xs text-gray-500">
                    {showPlatformWarning
                      ? "Debes proporcionar un nuevo Client Secret al cambiar de plataforma"
                      : "Solo completa si deseas cambiar las credenciales OAuth2"
                    }
                  </p>
                </div>

                <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                  <p className="text-xs text-blue-800">
                    ℹ️ El access token se genera automáticamente usando OAuth2
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

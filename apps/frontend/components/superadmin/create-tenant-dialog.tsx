"use client";

import { useState } from "react";
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
import { cn } from "@/lib/utils";
import Image from "next/image";
import { Loader2, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { createTenant } from "@/lib/api-client";

type EcommercePlatform = "shopify" | "woocommerce";

interface CreateTenantDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function CreateTenantDialog({ open, onOpenChange, onSuccess }: CreateTenantDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [platform, setPlatform] = useState<EcommercePlatform>("shopify");
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    // Datos generales
    name: "",
    slug: "",
    efact_ruc: "",

    // Nuevos campos - Datos de emisor
    emisor_nombre_comercial: "",
    emisor_ubigeo: "150101",
    emisor_departamento: "LIMA",
    emisor_provincia: "LIMA",
    emisor_distrito: "LIMA",
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
  });

  const handleNextStep = (e?: React.MouseEvent) => {
    e?.preventDefault();
    // Validar Step 1 antes de continuar
    if (currentStep === 1) {
      if (!formData.name) {
        toast({
          title: "Campo requerido",
          description: "El nombre de la empresa es obligatorio",
          variant: "destructive",
        });
        return;
      }
      if (formData.efact_ruc && !/^\d{11}$/.test(formData.efact_ruc)) {
        toast({
          title: "RUC inválido",
          description: "El RUC debe tener exactamente 11 dígitos",
          variant: "destructive",
        });
        return;
      }
      if (formData.emisor_ubigeo && !/^\d{6}$/.test(formData.emisor_ubigeo)) {
        toast({
          title: "UBIGEO inválido",
          description: "El UBIGEO debe tener exactamente 6 dígitos",
          variant: "destructive",
        });
        return;
      }
    }

    setCurrentStep(currentStep + 1);
  };

  const handlePreviousStep = (e?: React.MouseEvent) => {
    e?.preventDefault();
    setCurrentStep(currentStep - 1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Build request data matching backend TenantCreate schema
      const submitData: any = {
        name: formData.name,
        slug: formData.slug || undefined,
        efact_ruc: formData.efact_ruc || undefined,

        // Agregar campos eFact
        emisor_nombre_comercial: formData.emisor_nombre_comercial || undefined,
        emisor_ubigeo: formData.emisor_ubigeo || undefined,
        emisor_departamento: formData.emisor_departamento || undefined,
        emisor_provincia: formData.emisor_provincia || undefined,
        emisor_distrito: formData.emisor_distrito || undefined,
        emisor_direccion: formData.emisor_direccion || undefined,
      };

      // Add e-commerce platform configuration
      if (platform === "shopify") {
        submitData.ecommerce_platform = "shopify";
        submitData.ecommerce_store_url = formData.shopify_store_url;
        submitData.shopify_client_id = formData.shopify_client_id;
        submitData.shopify_client_secret = formData.shopify_client_secret;
        submitData.shopify_api_version = formData.shopify_api_version;
        submitData.sync_on_validation = true;
      } else if (platform === "woocommerce") {
        submitData.ecommerce_platform = "woocommerce";
        submitData.ecommerce_store_url = formData.woocommerce_url;
        submitData.ecommerce_consumer_key = formData.woocommerce_consumer_key;
        submitData.ecommerce_consumer_secret = formData.woocommerce_consumer_secret;
        submitData.sync_on_validation = true;
      }

      // ✅ Usa Client API Layer
      await createTenant(submitData);

      toast({
        title: "Tenant creado",
        description: "El tenant se ha creado correctamente",
      });

      // Reset form
      setFormData({
        name: "",
        slug: "",
        efact_ruc: "",
        emisor_nombre_comercial: "",
        emisor_ubigeo: "150101",
        emisor_departamento: "LIMA",
        emisor_provincia: "LIMA",
        emisor_distrito: "LIMA",
        emisor_direccion: "",
        shopify_store_url: "",
        shopify_client_id: "",
        shopify_client_secret: "",
        shopify_api_version: "2025-10",
        woocommerce_url: "",
        woocommerce_consumer_key: "",
        woocommerce_consumer_secret: "",
      });
      setPlatform("shopify");
      setCurrentStep(1);

      onSuccess();
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Error al crear tenant",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDialogClose = (open: boolean) => {
    if (!open) {
      setCurrentStep(1);
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Crear Nueva Empresa</DialogTitle>
          <DialogDescription>
            Paso {currentStep} de 2: {currentStep === 1 ? "Datos Generales y Ubicación" : "Configuración de eCommerce"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">

          {/* Step 1: Datos Generales + Ubicación */}
          {currentStep === 1 && (
            <div className="space-y-6">
              {/* Card: Datos Generales */}
              <div className="rounded-lg border p-4 space-y-4">
                <h3 className="font-semibold text-sm">Datos Generales</h3>

                {/* Nombre */}
                <div className="space-y-2">
                  <Label htmlFor="name">Nombre de la Empresa *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ej: Tienda Example"
                  />
                </div>

                {/* Slug */}
                <div className="space-y-2">
                  <Label htmlFor="slug" className="flex items-center gap-2">
                    Slug (Etiqueta)
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="inline-block w-4 h-4 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Si se deja vacío, se generará automáticamente como &quot;nombre-outlet&quot;</p>
                      </TooltipContent>
                    </Tooltip>
                  </Label>
                  <Input
                    id="slug"
                    value={formData.slug}
                    onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                    placeholder="tienda-example"
                    pattern="^[a-z0-9]+(?:-[a-z0-9]+)*$"
                  />
                </div>

                {/* RUC */}
                <div className="space-y-2">
                  <Label htmlFor="efact_ruc">RUC (Facturación Electrónica)</Label>
                  <Input
                    id="efact_ruc"
                    value={formData.efact_ruc}
                    onChange={(e) => setFormData({ ...formData, efact_ruc: e.target.value })}
                    placeholder="20123456789"
                    maxLength={11}
                  />
                  <p className="text-xs text-muted-foreground">11 dígitos</p>
                </div>

                {/* Nombre Comercial */}
                <div className="space-y-2">
                  <Label htmlFor="emisor_nombre_comercial">Nombre Comercial del Emisor</Label>
                  <Input
                    id="emisor_nombre_comercial"
                    value={formData.emisor_nombre_comercial}
                    onChange={(e) => setFormData({ ...formData, emisor_nombre_comercial: e.target.value })}
                    placeholder="Ej: Tienda Example S.A.C."
                  />
                </div>
              </div>

              {/* Card: Ubicación Fiscal */}
              <div className="rounded-lg border p-4 space-y-4">
                <h3 className="font-semibold text-sm">Ubicación Fiscal (Emisor)</h3>

                {/* UBIGEO */}
                <div className="space-y-2">
                  <Label htmlFor="emisor_ubigeo" className="flex items-center gap-2">
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
                    id="emisor_ubigeo"
                    value={formData.emisor_ubigeo}
                    onChange={(e) => setFormData({ ...formData, emisor_ubigeo: e.target.value })}
                    placeholder="150101"
                    maxLength={6}
                  />
                </div>

                {/* Grid 3 columnas: Departamento, Provincia, Distrito */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="emisor_departamento">Departamento</Label>
                    <Input
                      id="emisor_departamento"
                      value={formData.emisor_departamento}
                      onChange={(e) => setFormData({ ...formData, emisor_departamento: e.target.value })}
                      placeholder="LIMA"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="emisor_provincia">Provincia</Label>
                    <Input
                      id="emisor_provincia"
                      value={formData.emisor_provincia}
                      onChange={(e) => setFormData({ ...formData, emisor_provincia: e.target.value })}
                      placeholder="LIMA"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="emisor_distrito">Distrito</Label>
                    <Input
                      id="emisor_distrito"
                      value={formData.emisor_distrito}
                      onChange={(e) => setFormData({ ...formData, emisor_distrito: e.target.value })}
                      placeholder="LIMA"
                    />
                  </div>
                </div>

                {/* Dirección */}
                <div className="space-y-2">
                  <Label htmlFor="emisor_direccion">Dirección Fiscal</Label>
                  <Input
                    id="emisor_direccion"
                    value={formData.emisor_direccion}
                    onChange={(e) => setFormData({ ...formData, emisor_direccion: e.target.value })}
                    placeholder="Av. Ejemplo 123, Lima, Perú"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Configuración eCommerce */}
          {currentStep === 2 && (
            <div className="space-y-6">
              {/* Card: Plataforma eCommerce */}
              <div className="rounded-lg border p-4 space-y-4">
                <h3 className="font-semibold text-sm">Plataforma de eCommerce</h3>

                {/* Platform Selector */}
                <div className="grid grid-cols-2 gap-4">
                  {/* Shopify Card */}
                  <button
                    type="button"
                    onClick={() => setPlatform("shopify")}
                    className={cn(
                      "relative flex flex-col items-center gap-3 p-4 border-2 rounded-lg transition-all hover:shadow-md",
                      platform === "shopify"
                        ? "border-green-500 bg-green-50 shadow-md"
                        : "border-gray-200 bg-white hover:border-gray-300"
                    )}
                  >
                    <div className="relative w-12 h-12">
                      <Image
                        src="/external-icons/shopify-icon.png"
                        alt="Shopify"
                        fill
                        className="object-contain"
                      />
                    </div>
                    <span className={cn(
                      "font-medium text-sm",
                      platform === "shopify" ? "text-green-700" : "text-gray-700"
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
                  </button>

                  {/* WooCommerce Card */}
                  <button
                    type="button"
                    onClick={() => setPlatform("woocommerce")}
                    className={cn(
                      "relative flex flex-col items-center gap-3 p-4 border-2 rounded-lg transition-all hover:shadow-md",
                      platform === "woocommerce"
                        ? "border-purple-500 bg-purple-50 shadow-md"
                        : "border-gray-200 bg-white hover:border-gray-300"
                    )}
                  >
                    <div className="relative w-12 h-12">
                      <Image
                        src="/external-icons/woo-icon.png"
                        alt="WooCommerce"
                        fill
                        className="object-contain"
                      />
                    </div>
                    <span className={cn(
                      "font-medium text-sm",
                      platform === "woocommerce" ? "text-purple-700" : "text-gray-700"
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
                  </button>
                </div>

                {/* Shopify Fields */}
                {platform === "shopify" && (
                  <div className="space-y-4 pt-4">
                    <div className="space-y-2">
                      <Label htmlFor="shopify_store_url">Store URL *</Label>
                      <Input
                        id="shopify_store_url"
                        value={formData.shopify_store_url}
                        onChange={(e) => setFormData({ ...formData, shopify_store_url: e.target.value })}
                        placeholder="https://my-store.myshopify.com"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="shopify_client_id">Client ID *</Label>
                      <Input
                        id="shopify_client_id"
                        value={formData.shopify_client_id}
                        onChange={(e) => setFormData({ ...formData, shopify_client_id: e.target.value })}
                        placeholder="Shopify Client ID"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="shopify_client_secret">Client Secret *</Label>
                      <Input
                        id="shopify_client_secret"
                        type="password"
                        value={formData.shopify_client_secret}
                        onChange={(e) => setFormData({ ...formData, shopify_client_secret: e.target.value })}
                        placeholder="Shopify Client Secret"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="shopify_api_version">API Version</Label>
                      <Input
                        id="shopify_api_version"
                        value={formData.shopify_api_version}
                        onChange={(e) => setFormData({ ...formData, shopify_api_version: e.target.value })}
                        placeholder="2025-10"
                      />
                    </div>
                  </div>
                )}

                {/* WooCommerce Fields */}
                {platform === "woocommerce" && (
                  <div className="space-y-4 pt-4">
                    <div className="space-y-2">
                      <Label htmlFor="woocommerce_url">Store URL *</Label>
                      <Input
                        id="woocommerce_url"
                        value={formData.woocommerce_url}
                        onChange={(e) => setFormData({ ...formData, woocommerce_url: e.target.value })}
                        placeholder="https://my-store.com"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="woocommerce_consumer_key">Consumer Key *</Label>
                      <Input
                        id="woocommerce_consumer_key"
                        value={formData.woocommerce_consumer_key}
                        onChange={(e) => setFormData({ ...formData, woocommerce_consumer_key: e.target.value })}
                        placeholder="ck_xxxxxxxxxxxx"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="woocommerce_consumer_secret">Consumer Secret *</Label>
                      <Input
                        id="woocommerce_consumer_secret"
                        type="password"
                        value={formData.woocommerce_consumer_secret}
                        onChange={(e) => setFormData({ ...formData, woocommerce_consumer_secret: e.target.value })}
                        placeholder="cs_xxxxxxxxxxxx"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Footer con botones de navegación */}
          <DialogFooter className="flex justify-between">
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleDialogClose(false)}
                disabled={loading}
              >
                Cancelar
              </Button>

              {currentStep > 1 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={(e) => handlePreviousStep(e)}
                  disabled={loading}
                >
                  Anterior
                </Button>
              )}
            </div>

            <div>
              {currentStep < 2 ? (
                <Button
                  type="button"
                  onClick={(e) => handleNextStep(e)}
                  disabled={loading}
                >
                  Siguiente
                </Button>
              ) : (
                <Button type="submit" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creando...
                    </>
                  ) : (
                    "Crear Empresa"
                  )}
                </Button>
              )}
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

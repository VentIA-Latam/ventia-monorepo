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
  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    efact_ruc: "",
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Build request data matching backend TenantCreate schema
      const submitData: any = {
        name: formData.name,
        slug: formData.slug || undefined,
        efact_ruc: formData.efact_ruc || undefined,
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

      const response = await fetch('/api/superadmin/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submitData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al crear tenant');
      }

      toast({
        title: "Tenant creado",
        description: "El tenant se ha creado correctamente",
      });

      // Reset form
      setFormData({
        name: "",
        slug: "",
        efact_ruc: "",
        shopify_store_url: "",
        shopify_client_id: "",
        shopify_client_secret: "",
        shopify_api_version: "2025-10",
        woocommerce_url: "",
        woocommerce_consumer_key: "",
        woocommerce_consumer_secret: "",
      });
      setPlatform("shopify");

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Crear Nuevo Tenant</DialogTitle>
            <DialogDescription>
              Completa la información para crear un nuevo tenant en la plataforma
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">
                Nombre <span className="text-red-500">*</span>
              </Label>
              <Input
                id="name"
                placeholder="Ej: Nassau Outlet"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="slug">
                Slug (opcional)
              </Label>
              <Input
                id="slug"
                placeholder="Se genera automáticamente si está vacío"
                value={formData.slug}
                onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                pattern="^[a-z0-9]+(?:-[a-z0-9]+)*$"
              />
              <p className="text-xs text-gray-500">
                Formato: kebab-case (ej: nassau-outlet). Si se deja vacío, se genera como "nombre-outlet"
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="efact_ruc">
                RUC (Facturación Electrónica)
              </Label>
              <Input
                id="efact_ruc"
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

            <div className="grid gap-3">
              <Label>
                Plataforma de E-commerce <span className="text-red-500">*</span>
              </Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                {/* Shopify Card */}
                <button
                  type="button"
                  onClick={() => setPlatform("shopify")}
                  className={cn(
                    "relative flex flex-col items-center justify-center p-4 sm:p-6 rounded-lg border-2 transition-all hover:shadow-md",
                    platform === "shopify"
                      ? "border-green-500 bg-green-50 shadow-md"
                      : "border-gray-200 bg-white hover:border-gray-300"
                  )}
                >
                  <div className="relative w-12 h-12 sm:w-16 sm:h-16 mb-2 sm:mb-3">
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
                    "relative flex flex-col items-center justify-center p-4 sm:p-6 rounded-lg border-2 transition-all hover:shadow-md",
                    platform === "woocommerce"
                      ? "border-purple-500 bg-purple-50 shadow-md"
                      : "border-gray-200 bg-white hover:border-gray-300"
                  )}
                >
                  <div className="relative w-12 h-12 sm:w-16 sm:h-16 mb-2 sm:mb-3">
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
            </div>

            {/* Shopify Fields */}
            {platform === "shopify" && (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="shopify_store_url">
                    URL de tienda Shopify <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="shopify_store_url"
                    type="url"
                    placeholder="https://mi-tienda.myshopify.com"
                    value={formData.shopify_store_url}
                    onChange={(e) => setFormData({ ...formData, shopify_store_url: e.target.value })}
                    required
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="shopify_client_id" className="flex items-center gap-2">
                    Client ID de Shopify <span className="text-red-500">*</span>
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
                    id="shopify_client_id"
                    type="text"
                    placeholder="shpca_abc123..."
                    value={formData.shopify_client_id}
                    onChange={(e) => setFormData({ ...formData, shopify_client_id: e.target.value })}
                    required
                  />
                  <p className="text-xs text-gray-500">
                    Client ID de tu app de Shopify (se encriptará antes de guardarse)
                  </p>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="shopify_client_secret" className="flex items-center gap-2">
                    Client Secret de Shopify <span className="text-red-500">*</span>
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
                    id="shopify_client_secret"
                    type="password"
                    placeholder="shpcs_secret456..."
                    value={formData.shopify_client_secret}
                    onChange={(e) => setFormData({ ...formData, shopify_client_secret: e.target.value })}
                    required
                  />
                  <p className="text-xs text-gray-500">
                    Client Secret de tu app de Shopify (se encriptará antes de guardarse)
                  </p>
                </div>

                <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                  <p className="text-xs text-blue-800 font-medium mb-1">
                    💡 Tip: Necesitas crear una Custom App en Shopify Partners para obtener estas credenciales
                  </p>
                  <p className="text-xs text-blue-700">
                    El access token se generará automáticamente en el servidor usando OAuth2
                  </p>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="shopify_api_version">
                    Versión API Shopify
                  </Label>
                  <Input
                    id="shopify_api_version"
                    placeholder="2024-01"
                    value={formData.shopify_api_version}
                    onChange={(e) => setFormData({ ...formData, shopify_api_version: e.target.value })}
                  />
                </div>
              </>
            )}

            {/* WooCommerce Fields */}
            {platform === "woocommerce" && (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="woocommerce_url">
                    URL de WooCommerce <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="woocommerce_url"
                    type="url"
                    placeholder="https://mi-tienda.com"
                    value={formData.woocommerce_url}
                    onChange={(e) => setFormData({ ...formData, woocommerce_url: e.target.value })}
                    required
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="woocommerce_consumer_key">
                    Consumer Key <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="woocommerce_consumer_key"
                    type="password"
                    placeholder="ck_..."
                    value={formData.woocommerce_consumer_key}
                    onChange={(e) => setFormData({ ...formData, woocommerce_consumer_key: e.target.value })}
                    required
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="woocommerce_consumer_secret">
                    Consumer Secret <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="woocommerce_consumer_secret"
                    type="password"
                    placeholder="cs_..."
                    value={formData.woocommerce_consumer_secret}
                    onChange={(e) => setFormData({ ...formData, woocommerce_consumer_secret: e.target.value })}
                    required
                  />
                  <p className="text-xs text-gray-500">
                    Credenciales de WooCommerce REST API (se encriptarán antes de guardarse)
                  </p>
                </div>
              </>
            )}
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
              Crear Tenant
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

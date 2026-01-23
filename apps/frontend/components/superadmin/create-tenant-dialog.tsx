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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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
    // Shopify fields
    shopify_store_url: "",
    shopify_access_token: "",
    shopify_api_version: "2024-01",
    // WooCommerce fields
    woocommerce_url: "",
    woocommerce_consumer_key: "",
    woocommerce_consumer_secret: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Preparar datos según la plataforma seleccionada
      const submitData: any = {
        name: formData.name,
        slug: formData.slug,
      };

      if (platform === "shopify") {
        submitData.shopify_store_url = formData.shopify_store_url;
        submitData.shopify_access_token = formData.shopify_access_token;
        submitData.shopify_api_version = formData.shopify_api_version;
      } else if (platform === "woocommerce") {
        submitData.woocommerce_url = formData.woocommerce_url;
        submitData.woocommerce_consumer_key = formData.woocommerce_consumer_key;
        submitData.woocommerce_consumer_secret = formData.woocommerce_consumer_secret;
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
        shopify_store_url: "",
        shopify_access_token: "",
        shopify_api_version: "2024-01",
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
      <DialogContent className="sm:max-w-[600px]">
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
              <Label htmlFor="platform">
                Plataforma de E-commerce <span className="text-red-500">*</span>
              </Label>
              <Select value={platform} onValueChange={(value: EcommercePlatform) => setPlatform(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona una plataforma" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="shopify">Shopify</SelectItem>
                  <SelectItem value="woocommerce">WooCommerce</SelectItem>
                </SelectContent>
              </Select>
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
                  <Label htmlFor="shopify_access_token">
                    Token de acceso Shopify <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="shopify_access_token"
                    type="password"
                    placeholder="shpat_..."
                    value={formData.shopify_access_token}
                    onChange={(e) => setFormData({ ...formData, shopify_access_token: e.target.value })}
                    required
                  />
                  <p className="text-xs text-gray-500">
                    Token de Admin API de Shopify (se encriptará antes de guardarse)
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

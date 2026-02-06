"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getTenant } from "@/lib/api-client";
import { ArrowLeft, Building2, Calendar, Globe, Users, Package, Shield, Store, ShoppingBag, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { TenantDetail, EcommercePlatform } from "@/lib/types/tenant";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate, formatDateTime } from "@/lib/utils";

export default function TenantDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [tenant, setTenant] = useState<TenantDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Helper para obtener plataforma del tenant
  const getTenantPlatform = (): EcommercePlatform => {
    if (!tenant) return null;
    // Usar ecommerce_settings del backend (nueva forma)
    if (tenant.ecommerce_settings?.platform) {
      return tenant.ecommerce_settings.platform;
    }
    // Fallback a settings legacy
    if (tenant.settings?.ecommerce?.shopify) return "shopify";
    if (tenant.settings?.ecommerce?.woocommerce) return "woocommerce";
    if (tenant.shopify_store_url) return "shopify"; // Fallback legacy
    return null;
  };

  // Helper para obtener URL de la tienda
  const getStoreUrl = (): string | null => {
    if (!tenant) return null;
    // Usar ecommerce_settings del backend (nueva forma)
    if (tenant.ecommerce_settings?.store_url) {
      return tenant.ecommerce_settings.store_url;
    }
    // Fallback a settings legacy
    if (tenant.settings?.ecommerce?.shopify) return tenant.settings.ecommerce.shopify.store_url;
    if (tenant.settings?.ecommerce?.woocommerce) return tenant.settings.ecommerce.woocommerce.store_url;
    return tenant.shopify_store_url; // Fallback legacy
  };

  // Helper para obtener estado de sincronización
  const getSyncStatus = (): boolean => {
    if (!tenant) return false;
    // Usar ecommerce_settings del backend (nueva forma)
    if (tenant.ecommerce_settings) {
      return tenant.ecommerce_settings.sync_on_validation;
    }
    // Fallback a settings legacy
    return tenant.settings?.ecommerce?.sync_on_validation ?? false;
  };

  const fetchTenantDetail = async () => {
    try {
      setLoading(true);
      // ✅ Usa Client API Layer
      const data = await getTenant(parseInt(params.id as string));
      setTenant(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar los detalles del tenant');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTenantDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-96" />
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      </div>
    );
  }

  if (error || !tenant) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Volver
        </Button>
        <Card>
          <CardContent className="py-12">
            <div className="text-center space-y-4">
              <Building2 className="h-12 w-12 text-muted-foreground mx-auto" />
              <div>
                <h3 className="text-lg font-semibold">Error al cargar tenant</h3>
                <p className="text-muted-foreground">{error || 'No se encontró el tenant'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold text-foreground font-heading">{tenant.name}</h1>
              {tenant.is_active ? (
                <Badge className="bg-success-bg text-success border-success/30">Activo</Badge>
              ) : (
                <Badge className="bg-muted/50 text-foreground border-border">Inactivo</Badge>
              )}
              {tenant.is_platform && (
                <Badge variant="secondary" className="bg-luma/15 text-marino">
                  <Shield className="mr-1 h-3 w-3" />
                  Plataforma
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground mt-1">
              Slug: <code className="text-sm bg-muted px-2 py-1 rounded">{tenant.slug}</code>
            </p>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Usuarios Activos</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{tenant.user_count}</div>
            <p className="text-xs text-muted-foreground">
              Usuarios en este tenant
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Órdenes Totales</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{tenant.order_count}</div>
            <p className="text-xs text-muted-foreground">
              Órdenes registradas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Plataforma</CardTitle>
            {getTenantPlatform() === "shopify" ? (
              <ShoppingBag className="h-4 w-4 text-success" />
            ) : getTenantPlatform() === "woocommerce" ? (
              <Store className="h-4 w-4 text-marino" />
            ) : (
              <Store className="h-4 w-4 text-muted-foreground" />
            )}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold capitalize">
              {getTenantPlatform() || "—"}
            </div>
            <p className="text-xs text-muted-foreground">
              Plataforma de e-commerce
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Fecha de Creación</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold">
              {formatDate(tenant.created_at)}
            </div>
            <p className="text-xs text-muted-foreground">
              Actualizado: {formatDate(tenant.updated_at)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Details Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Información General */}
        <Card>
          <CardHeader>
            <CardTitle>Información General</CardTitle>
            <CardDescription>
              Datos básicos del tenant
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="text-sm font-medium text-muted-foreground">Nombre</div>
              <div className="mt-1 text-base font-medium">{tenant.name}</div>
            </div>

            <div>
              <div className="text-sm font-medium text-muted-foreground">Slug</div>
              <div className="mt-1">
                <code className="text-sm bg-muted px-2 py-1 rounded">{tenant.slug}</code>
              </div>
            </div>

            <div>
              <div className="text-sm font-medium text-muted-foreground">Company ID</div>
              <div className="mt-1 text-base">
                {tenant.company_id || (
                  <span className="text-muted-foreground italic">No configurado</span>
                )}
              </div>
            </div>

            <div>
              <div className="text-sm font-medium text-muted-foreground">Estado</div>
              <div className="mt-1">
                {tenant.is_active ? (
                  <Badge className="bg-success-bg text-success border-success/30">
                    <CheckCircle2 className="mr-1 h-3 w-3" />
                    Activo
                  </Badge>
                ) : (
                  <Badge className="bg-muted/50 text-foreground border-border">
                    <XCircle className="mr-1 h-3 w-3" />
                    Inactivo
                  </Badge>
                )}
              </div>
            </div>

            <Separator />

            <div className="grid gap-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">ID del Tenant:</span>
                <span className="font-mono">{tenant.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Creado:</span>
                <span className="text-sm">{formatDateTime(tenant.created_at)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Actualizado:</span>
                <span className="text-sm">{formatDateTime(tenant.updated_at)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Configuración E-commerce */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {getTenantPlatform() === "shopify" ? (
                <ShoppingBag className="h-5 w-5 text-success" />
              ) : getTenantPlatform() === "woocommerce" ? (
                <Store className="h-5 w-5 text-marino" />
              ) : (
                <Store className="h-5 w-5 text-muted-foreground" />
              )}
              Configuración de E-commerce
            </CardTitle>
            <CardDescription>
              Integración con plataforma de comercio electrónico
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {getTenantPlatform() ? (
              <>
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Plataforma</div>
                  <div className="mt-2">
                    {getTenantPlatform() === "shopify" ? (
                      <Badge className="bg-success-bg text-success border-0">
                        <ShoppingBag className="mr-1 h-3 w-3" />
                        Shopify
                      </Badge>
                    ) : (
                      <Badge className="bg-luma/15 text-marino border-0">
                        <Store className="mr-1 h-3 w-3" />
                        WooCommerce
                      </Badge>
                    )}
                  </div>
                </div>

                <div>
                  <div className="text-sm font-medium text-muted-foreground">URL de Tienda</div>
                  <div className="mt-1">
                    {getStoreUrl() ? (
                      <a
                        href={getStoreUrl()!}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-volt hover:underline flex items-center gap-1 text-sm"
                      >
                        <Globe className="h-4 w-4" />
                        {getStoreUrl()}
                      </a>
                    ) : (
                      <span className="text-muted-foreground italic">No configurada</span>
                    )}
                  </div>
                </div>

                {getTenantPlatform() === "shopify" && tenant.settings?.ecommerce?.shopify?.api_version && (
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">Versión API</div>
                    <div className="mt-1">
                      <code className="text-sm bg-muted px-2 py-1 rounded">
                        {tenant.settings.ecommerce.shopify.api_version}
                      </code>
                    </div>
                  </div>
                )}

                <div>
                  <div className="text-sm font-medium text-muted-foreground">Sincronización Automática</div>
                  <div className="mt-2">
                    {getSyncStatus() ? (
                      <Badge className="bg-success-bg text-success border-0">
                        <CheckCircle2 className="mr-1 h-3 w-3" />
                        Activa al validar pagos
                      </Badge>
                    ) : (
                      <Badge className="bg-muted text-muted-foreground border-0">
                        <XCircle className="mr-1 h-3 w-3" />
                        Desactivada
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {getSyncStatus()
                      ? "Los pedidos se sincronizan automáticamente al validar pagos"
                      : "La sincronización debe realizarse manualmente"
                    }
                  </p>
                </div>

                <div>
                  <div className="text-sm font-medium text-muted-foreground mb-2">Credenciales</div>
                  <div className="space-y-3">
                    {getTenantPlatform() === "shopify" && (
                      <>
                        <div>
                          <div className="text-xs text-muted-foreground mb-1">Client ID</div>
                          <span className="text-sm bg-muted px-2 py-1 rounded text-muted-foreground">
                            ••••••••••••••••
                          </span>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground mb-1">Client Secret</div>
                          <span className="text-sm bg-muted px-2 py-1 rounded text-muted-foreground">
                            ••••••••••••••••
                          </span>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground mb-1">Access Token</div>
                          <span className="text-sm bg-muted px-2 py-1 rounded text-muted-foreground">
                            •••••••• (generado automáticamente)
                          </span>
                          <div className="mt-1">
                            <Badge className="bg-success-bg text-success border-0 text-xs">
                              OAuth2 Activo
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            Se renueva automáticamente cada 24 horas
                          </p>
                        </div>
                      </>
                    )}
                    {getTenantPlatform() === "woocommerce" && (
                      <>
                        <div>
                          <div className="text-xs text-muted-foreground mb-1">Consumer Key</div>
                          <span className="text-sm bg-muted px-2 py-1 rounded text-muted-foreground">
                            ••••••••••••••••
                          </span>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground mb-1">Consumer Secret</div>
                          <span className="text-sm bg-muted px-2 py-1 rounded text-muted-foreground">
                            ••••••••••••••••
                          </span>
                        </div>
                      </>
                    )}
                    <p className="text-xs text-muted-foreground mt-2">
                      Por seguridad, las credenciales no se muestran
                    </p>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-8">
                <Store className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground font-medium">Sin plataforma configurada</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Este tenant no tiene integración con ninguna plataforma de e-commerce
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

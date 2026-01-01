"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Building2, Calendar, Globe, Users, Package, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { TenantDetail } from "@/lib/types/tenant";
import { Skeleton } from "@/components/ui/skeleton";

export default function TenantDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [tenant, setTenant] = useState<TenantDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchTenantDetail();
  }, [params.id]);

  const fetchTenantDetail = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/superadmin/tenants/${params.id}`);

      if (!response.ok) {
        throw new Error('Error al cargar los detalles del tenant');
      }

      const data = await response.json();
      setTenant(data);
    } catch (error) {
      console.error('Error fetching tenant detail:', error);
      setError(error instanceof Error ? error.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

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
              <Building2 className="h-12 w-12 text-gray-300 mx-auto" />
              <div>
                <h3 className="text-lg font-semibold">Error al cargar tenant</h3>
                <p className="text-gray-500">{error || 'No se encontró el tenant'}</p>
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
              <h1 className="text-3xl font-bold text-gray-900">{tenant.name}</h1>
              {tenant.is_active ? (
                <Badge className="bg-green-100 text-green-700">Activo</Badge>
              ) : (
                <Badge variant="destructive">Inactivo</Badge>
              )}
              {tenant.is_platform && (
                <Badge variant="secondary" className="bg-purple-100 text-purple-700">
                  <Shield className="mr-1 h-3 w-3" />
                  Plataforma
                </Badge>
              )}
            </div>
            <p className="text-gray-600 mt-1">
              Slug: <code className="text-sm bg-gray-100 px-2 py-1 rounded">{tenant.slug}</code>
            </p>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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
            <CardTitle className="text-sm font-medium">Fecha de Creación</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Date(tenant.created_at).toLocaleDateString('es-ES', {
                day: '2-digit',
                month: 'short',
                year: 'numeric'
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              Última actualización: {new Date(tenant.updated_at).toLocaleDateString('es-ES')}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Details Card */}
      <Card>
        <CardHeader>
          <CardTitle>Información del Tenant</CardTitle>
          <CardDescription>
            Detalles de configuración y credenciales
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <div className="text-sm font-medium text-gray-500">Nombre</div>
              <div className="mt-1 text-base">{tenant.name}</div>
            </div>

            <div>
              <div className="text-sm font-medium text-gray-500">Slug</div>
              <div className="mt-1">
                <code className="text-sm bg-gray-100 px-2 py-1 rounded">{tenant.slug}</code>
              </div>
            </div>

            <div>
              <div className="text-sm font-medium text-gray-500">Company ID</div>
              <div className="mt-1 text-base">
                {tenant.company_id || (
                  <span className="text-gray-400 italic">No configurado</span>
                )}
              </div>
            </div>

            <div>
              <div className="text-sm font-medium text-gray-500">Estado</div>
              <div className="mt-1">
                {tenant.is_active ? (
                  <Badge className="bg-green-100 text-green-700">Activo</Badge>
                ) : (
                  <Badge variant="destructive">Inactivo</Badge>
                )}
              </div>
            </div>
          </div>

          <Separator />

          <div>
            <div className="flex items-center gap-2 mb-3">
              <Globe className="h-5 w-5 text-gray-500" />
              <h3 className="text-lg font-semibold">Configuración de Shopify</h3>
            </div>

            <div className="grid gap-4">
              <div>
                <div className="text-sm font-medium text-gray-500">URL de Tienda</div>
                <div className="mt-1">
                  {tenant.shopify_store_url ? (
                    <a
                      href={tenant.shopify_store_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline flex items-center gap-1"
                    >
                      {tenant.shopify_store_url}
                      <Globe className="h-4 w-4" />
                    </a>
                  ) : (
                    <span className="text-gray-400 italic">No configurada</span>
                  )}
                </div>
              </div>

              <div>
                <div className="text-sm font-medium text-gray-500">Token de Acceso</div>
                <div className="mt-1">
                  <span className="text-sm bg-gray-100 px-2 py-1 rounded text-gray-600">
                    ••••••••••••••••
                  </span>
                  <p className="text-xs text-gray-500 mt-1">
                    Por seguridad, el token no se muestra
                  </p>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          <div className="grid gap-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">ID del Tenant:</span>
              <span className="font-mono">{tenant.id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Creado:</span>
              <span>
                {new Date(tenant.created_at).toLocaleString('es-ES', {
                  dateStyle: 'medium',
                  timeStyle: 'short'
                })}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Última actualización:</span>
              <span>
                {new Date(tenant.updated_at).toLocaleString('es-ES', {
                  dateStyle: 'medium',
                  timeStyle: 'short'
                })}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

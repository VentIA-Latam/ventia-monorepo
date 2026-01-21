"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, User as UserIcon, Calendar, Mail, Shield, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { User } from "@/lib/types/user";
import { formatDate, formatDateTime } from "@/lib/utils";

export default function UserDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUser = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/superadmin/users/${params.id}`);

      if (!response.ok) {
        throw new Error('Error al cargar los detalles del usuario');
      }

      const data = await response.json();
      setUser(data);
    } catch (error) {
      console.error('Error fetching user detail:', error);
      setError(error instanceof Error ? error.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUser();
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

  if (error || !user) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Volver
        </Button>
        <Card>
          <CardContent className="py-12">
            <div className="text-center space-y-4">
              <UserIcon className="h-12 w-12 text-gray-300 mx-auto" />
              <div>
                <h3 className="text-lg font-semibold">Error al cargar usuario</h3>
                <p className="text-gray-500">{error || 'No se encontró el usuario'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'SUPER_ADMIN':
        return 'bg-purple-100 text-purple-700';
      case 'ADMIN':
        return 'bg-blue-100 text-blue-700';
      case 'LOGISTICA':
        return 'bg-orange-100 text-orange-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

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
              <h1 className="text-3xl font-bold text-gray-900">{user.name}</h1>
              {user.is_active ? (
                <Badge className="bg-green-100 text-green-700">Activo</Badge>
              ) : (
                <Badge variant="destructive">Inactivo</Badge>
              )}
              <Badge className={getRoleBadgeColor(user.role)}>
                <Shield className="mr-1 h-3 w-3" />
                {user.role}
              </Badge>
            </div>
            <p className="text-gray-600 mt-1 flex items-center gap-2">
              <Mail className="h-4 w-4" />
              {user.email}
            </p>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rol del Usuario</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{user.role}</div>
            <p className="text-xs text-muted-foreground">
              Nivel de acceso
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Estado</CardTitle>
            <UserIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {user.is_active ? (
                <Badge className="bg-green-100 text-green-700">Activo</Badge>
              ) : (
                <Badge variant="destructive">Inactivo</Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Estado actual del usuario
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
              {formatDate(user.created_at)}
            </div>
            <p className="text-xs text-muted-foreground">
              Última actualización: {formatDate(user.updated_at)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Details Card */}
      <Card>
        <CardHeader>
          <CardTitle>Información del Usuario</CardTitle>
          <CardDescription>
            Detalles de cuenta y permisos
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <div className="text-sm font-medium text-gray-500">Nombre Completo</div>
              <div className="mt-1 text-base">{user.name}</div>
            </div>

            <div>
              <div className="text-sm font-medium text-gray-500">Correo Electrónico</div>
              <div className="mt-1 text-base flex items-center gap-2">
                <Mail className="h-4 w-4 text-gray-500" />
                {user.email}
              </div>
            </div>

            <div>
              <div className="text-sm font-medium text-gray-500">Rol</div>
              <div className="mt-1">
                <Badge className={getRoleBadgeColor(user.role)}>
                  <Shield className="mr-1 h-3 w-3" />
                  {user.role}
                </Badge>
              </div>
            </div>

            <div>
              <div className="text-sm font-medium text-gray-500">Estado</div>
              <div className="mt-1">
                {user.is_active ? (
                  <Badge className="bg-green-100 text-green-700">Activo</Badge>
                ) : (
                  <Badge variant="destructive">Inactivo</Badge>
                )}
              </div>
            </div>

            {user.tenant_id && (
              <div>
                <div className="text-sm font-medium text-gray-500">Tenant ID</div>
                <div className="mt-1 text-base flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-gray-500" />
                  <code className="text-sm bg-gray-100 px-2 py-1 rounded">{user.tenant_id}</code>
                </div>
              </div>
            )}
          </div>

          <Separator />

          <div className="grid gap-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">ID del Usuario:</span>
              <span className="font-mono">{user.id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Creado:</span>
              <span>
                {formatDateTime(user.created_at)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Última actualización:</span>
              <span>
                {formatDateTime(user.updated_at)}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

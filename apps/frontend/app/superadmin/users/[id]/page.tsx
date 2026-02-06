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
import { getRoleLabel } from "@/lib/constants/roles";

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
              <UserIcon className="h-12 w-12 text-muted-foreground mx-auto" />
              <div>
                <h3 className="text-lg font-semibold">Error al cargar usuario</h3>
                <p className="text-muted-foreground">{error || 'No se encontró el usuario'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'SUPERADMIN':
        return 'bg-luma/15 text-marino';
      case 'ADMIN':
        return 'bg-volt/10 text-volt';
      case 'LOGISTICA':
        return 'bg-warning-bg text-warning';
      case 'VENTAS':
        return 'bg-success-bg text-success';
      case 'VIEWER':
        return 'bg-muted text-foreground';
      default:
        return 'bg-muted text-foreground';
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
              <h1 className="text-3xl font-bold text-foreground font-heading">{user.name}</h1>
              {user.is_active ? (
                <Badge className="bg-success-bg text-success border-success/30">Activo</Badge>
              ) : (
                <Badge className="bg-muted/50 text-foreground border-border">Inactivo</Badge>
              )}
              <Badge className={getRoleBadgeColor(user.role)}>
                <Shield className="mr-1 h-3 w-3" />
                {getRoleLabel(user.role)}
              </Badge>
            </div>
            <p className="text-muted-foreground mt-1 flex items-center gap-2">
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
            <div className="text-2xl font-bold">{getRoleLabel(user.role)}</div>
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
                <Badge className="bg-success-bg text-success border-success/30">Activo</Badge>
              ) : (
                <Badge className="bg-muted/50 text-foreground border-border">Inactivo</Badge>
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
              <div className="text-sm font-medium text-muted-foreground">Nombre Completo</div>
              <div className="mt-1 text-base">{user.name}</div>
            </div>

            <div>
              <div className="text-sm font-medium text-muted-foreground">Correo Electrónico</div>
              <div className="mt-1 text-base flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                {user.email}
              </div>
            </div>

            <div>
              <div className="text-sm font-medium text-muted-foreground">Rol</div>
              <div className="mt-1">
                <Badge className={getRoleBadgeColor(user.role)}>
                  <Shield className="mr-1 h-3 w-3" />
                  {getRoleLabel(user.role)}
                </Badge>
              </div>
            </div>

            <div>
              <div className="text-sm font-medium text-muted-foreground">Estado</div>
              <div className="mt-1">
                {user.is_active ? (
                  <Badge className="bg-success-bg text-success border-success/30">Activo</Badge>
                ) : (
                  <Badge className="bg-muted/50 text-foreground border-border">Inactivo</Badge>
                )}
              </div>
            </div>

            {user.tenant_id && (
              <div>
                <div className="text-sm font-medium text-muted-foreground">Tenant ID</div>
                <div className="mt-1 text-base flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <code className="text-sm bg-muted px-2 py-1 rounded">{user.tenant_id}</code>
                </div>
              </div>
            )}
          </div>

          <Separator />

          <div className="grid gap-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">ID del Usuario:</span>
              <span className="font-mono">{user.id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Creado:</span>
              <span>
                {formatDateTime(user.created_at)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Última actualización:</span>
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

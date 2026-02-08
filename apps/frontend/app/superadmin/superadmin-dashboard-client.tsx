"use client";

import { useState } from "react";
import { Building2, Users, Key, Shield, Package, Activity, Clock, AlertTriangle, ArrowUpRight, Search, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatsCard } from "@/components/dashboard/stats-card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/utils";
import type { Tenant } from "@/lib/types/tenant";
import type { SuperAdminStats, RecentActivity, GlobalOrder } from "@/lib/services/superadmin-service";

interface SuperAdminDashboardClientProps {
  stats: SuperAdminStats;
  tenants: Tenant[];
  globalOrders: GlobalOrder[];
  activities: RecentActivity[];
}

export function SuperAdminDashboardClient({ stats, tenants, globalOrders, activities }: SuperAdminDashboardClientProps) {
  const [searchTerm, setSearchTerm] = useState("");

  // Filter tenants and orders based on search
  const filteredTenants = tenants.filter(t =>
    t.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.slug?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredOrders = globalOrders.filter(o =>
    o.id.toString().includes(searchTerm) ||
    o.customer_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Calculate metrics
  const activeTenants = tenants.filter(t => t.is_active);
  const inactiveTenants = tenants.filter(t => !t.is_active);
  const topTenants = activeTenants.slice(0, 5);

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header with Search */}
      <div className="flex flex-col gap-3 md:gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground font-heading">Dashboard Global</h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">Vista completa de toda la plataforma VentIA</p>
        </div>
        <div className="flex gap-2 w-full md:max-w-md md:w-auto">
          <Input
            placeholder="Buscar tenant, orden, usuario..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 text-sm md:text-base"
          />
          <Button variant="outline" size="icon" className="shrink-0">
            <Search className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Platform Stats */}
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 md:gap-4 lg:gap-6">
        <StatsCard
          title="Empresas Activas"
          value={stats.total_tenants.toString()}
          icon={<Building2 className="h-5 w-5" />}
          accentColor="volt"
          change={`${inactiveTenants.length} inactivos`}
          changeType="negative"
        />
        <StatsCard
          title="Total Usuarios"
          value={stats.total_users.toString()}
          icon={<Users className="h-5 w-5" />}
          accentColor="success"
          comparison={`En ${stats.total_tenants} organizaciones`}
        />
        <StatsCard
          title="API Keys Activas"
          value={(stats.active_api_keys ?? 0).toString()}
          icon={<Key className="h-5 w-5" />}
          accentColor="marino"
          comparison="Credenciales en uso"
        />
        <StatsCard
          title="Super Admins"
          value={(stats.total_super_admins ?? 0).toString()}
          icon={<Shield className="h-5 w-5" />}
          accentColor="warning"
          comparison="Administradores de sistema"
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-4 md:gap-6 grid-cols-1 lg:grid-cols-3">
        {/* Top Tenants */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                  <Building2 className="h-4 w-4 md:h-5 md:w-5 text-volt" />
                  Top Tenants
                </CardTitle>
                <CardDescription className="text-xs md:text-sm">Organizaciones mas activas</CardDescription>
              </div>
              <Button variant="ghost" size="sm" asChild className="w-fit">
                <a href="/superadmin/tenants" className="text-xs md:text-sm">
                  Ver todos <ArrowUpRight className="ml-1 h-3 w-3 md:h-4 md:w-4" />
                </a>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {inactiveTenants.length > 0 && (
              <div className="mb-4 p-3 bg-warning-bg border border-warning/30 rounded-lg">
                <div className="flex items-center gap-2 text-warning">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="text-sm font-medium">
                    {inactiveTenants.length} tenant{inactiveTenants.length !== 1 ? 's' : ''} inactivo{inactiveTenants.length !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>
            )}
            <div className="space-y-3">
              {(searchTerm ? filteredTenants : topTenants).slice(0, 5).map((tenant) => (
                <div
                  key={tenant.id}
                  className="flex items-center justify-between p-2 md:p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer"
                  onClick={() => window.location.href = `/superadmin/tenants`}
                >
                  <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
                    <div className="h-8 w-8 md:h-10 md:w-10 rounded-full bg-volt/10 flex items-center justify-center shrink-0">
                      <Building2 className="h-4 w-4 md:h-5 md:w-5 text-volt" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-xs md:text-sm truncate">{tenant.name}</p>
                      <p className="text-[10px] md:text-xs text-muted-foreground truncate">@{tenant.slug}</p>
                    </div>
                  </div>
                  <Badge className={`text-[10px] md:text-xs shrink-0 ${tenant.is_active ? "bg-success-bg text-success border-success/30" : "bg-muted/50 text-foreground border-border"}`}>
                    {tenant.is_active ? "Activo" : "Inactivo"}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Global Orders */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                  <Package className="h-4 w-4 md:h-5 md:w-5 text-warning" />
                  Ordenes Recientes Globales
                </CardTitle>
                <CardDescription className="text-xs md:text-sm">Ultimas ordenes de todos los tenants</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {(searchTerm ? filteredOrders : globalOrders).slice(0, 8).map((order) => (
                <div
                  key={order.id}
                  className="flex items-center justify-between p-2 md:p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                >
                  <div className="flex items-center gap-2 md:gap-3 flex-1 min-w-0">
                    <div className={`p-1.5 md:p-2 rounded-lg shrink-0 ${order.status === 'Pagado' ? 'bg-success-bg' : 'bg-warning-bg'
                      }`}>
                      {order.status === 'Pagado' ? (
                        <CheckCircle2 className="h-3 w-3 md:h-4 md:w-4 text-success" />
                      ) : (
                        <Clock className="h-3 w-3 md:h-4 md:w-4 text-warning" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1 md:gap-2 flex-wrap">
                        <p className="font-medium text-xs md:text-sm">#{order.id}</p>
                        <Badge variant="outline" className="text-[10px] md:text-xs">
                          {order.tenant?.name || `Tenant ${order.tenant_id}`}
                        </Badge>
                      </div>
                      <p className="text-[10px] md:text-xs text-muted-foreground truncate">{order.customer_name}</p>
                    </div>
                  </div>
                  <div className="text-right ml-2 md:ml-4 shrink-0">
                    <p className="font-semibold text-xs md:text-sm">
                      {order.currency} {order.total_price?.toFixed(2) || '0.00'}
                    </p>
                    <Badge
                      className={`text-[10px] md:text-xs mt-1 ${order.status === 'Pagado' ? "bg-success-bg text-success border-success/30" : "bg-warning-bg text-warning border-warning/30"}`}
                    >
                      {order.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Activity Feed */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 md:h-5 md:w-5 text-volt" />
            <div>
              <CardTitle className="text-base md:text-lg">Actividad en Tiempo Real</CardTitle>
              <CardDescription className="text-xs md:text-sm">Eventos recientes en la plataforma</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 grid-cols-1 md:grid-cols-2 md:gap-3">
            {(activities || []).map((activity) => {
              const getIcon = () => {
                const type = activity.entity_type.toLowerCase();
                if (type === 'user') return <Users className="h-4 w-4" />;
                if (type === 'tenant') return <Building2 className="h-4 w-4" />;
                if (type === 'api_key') return <Key className="h-4 w-4" />;
                return <Activity className="h-4 w-4" />;
              };

              const getColor = () => {
                const type = activity.entity_type.toLowerCase();
                if (type === 'user') return 'bg-success-bg text-success';
                if (type === 'tenant') return 'bg-volt/10 text-volt';
                if (type === 'api_key') return 'bg-luma/15 text-marino';
                return 'bg-muted text-foreground';
              };

              const translateOperation = (operation: string) => {
                const translations: Record<string, string> = {
                  'CREATED': 'Creado',
                  'UPDATED': 'Actualizado',
                  'DELETED': 'Eliminado',
                  'LOGGED_IN': 'Inicio de sesion',
                  'LOGGED_OUT': 'Cierre de sesion',
                };
                return translations[operation] || operation;
              };

              return (
                <div key={`${activity.entity_type}-${activity.id}`} className="flex items-start gap-2 md:gap-3 p-2 md:p-3 rounded-lg bg-muted/50">
                  <div className={`p-1.5 md:p-2 rounded-full shrink-0 ${getColor()}`}>
                    {getIcon()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs md:text-sm font-medium text-foreground truncate">
                      {activity.description}
                    </p>
                    <div className="flex items-center gap-1 md:gap-2 mt-1 flex-wrap">
                      <Badge variant="outline" className="text-[10px] md:text-xs">
                        {translateOperation(activity.operation)}
                      </Badge>
                      <span className="text-[10px] md:text-xs text-muted-foreground">
                        {formatDateTime(activity.timestamp)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base md:text-lg">Acciones Rapidas</CardTitle>
          <CardDescription className="text-xs md:text-sm">Gestion y administracion de la plataforma</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 grid-cols-2 md:grid-cols-4 md:gap-4">
            <Button variant="outline" className="h-16 md:h-20 flex-col gap-1 md:gap-2" asChild>
              <a href="/superadmin/tenants">
                <Building2 className="h-5 w-5 md:h-6 md:w-6 text-volt" />
                <span className="text-xs md:text-sm font-medium text-center">Gestionar Tenants</span>
              </a>
            </Button>
            <Button variant="outline" className="h-16 md:h-20 flex-col gap-1 md:gap-2" asChild>
              <a href="/superadmin/users">
                <Users className="h-5 w-5 md:h-6 md:w-6 text-success" />
                <span className="text-xs md:text-sm font-medium text-center">Gestionar Usuarios</span>
              </a>
            </Button>
            <Button variant="outline" className="h-16 md:h-20 flex-col gap-1 md:gap-2" asChild>
              <a href="/superadmin/api-keys">
                <Key className="h-5 w-5 md:h-6 md:w-6 text-marino" />
                <span className="text-xs md:text-sm font-medium text-center">API Keys</span>
              </a>
            </Button>
            <Button variant="outline" className="h-16 md:h-20 flex-col gap-1 md:gap-2" asChild>
              <a href="/dashboard/get-started">
                <Activity className="h-5 w-5 md:h-6 md:w-6 text-warning" />
                <span className="text-xs md:text-sm font-medium text-center">Ver Dashboard</span>
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


"use client";

import { useEffect, useState } from "react";
import { Building2, Users, Key, Shield, Package, Activity, TrendingUp, Clock, AlertTriangle, ArrowUpRight, Search, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { getPlatformStats, getRecentActivity, type PlatformStats, type Activity as ActivityType } from "@/lib/services/stats";
import { getAllTenants, getGlobalOrders, type TenantSummary, type GlobalOrder } from "@/lib/services/superadmin";

export default function SuperAdminDashboard() {
  const [platformStats, setPlatformStats] = useState<PlatformStats | null>(null);
  const [tenants, setTenants] = useState<TenantSummary[]>([]);
  const [globalOrders, setGlobalOrders] = useState<GlobalOrder[]>([]);
  const [activities, setActivities] = useState<ActivityType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch all data in parallel
        const [statsData, tenantsData, ordersData, activityData] = await Promise.all([
          getPlatformStats(),
          getAllTenants(),
          getGlobalOrders(15),
          getRecentActivity(10),
        ]);

        setPlatformStats(statsData);
        setTenants(tenantsData);
        setGlobalOrders(ordersData);
        setActivities(activityData.activities);
      } catch (err) {
        console.error("Error fetching dashboard data:", err);
        setError(err instanceof Error ? err.message : "Failed to load data");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Filter tenants and orders based on search
  const filteredTenants = tenants.filter(t =>
    t.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.slug?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredOrders = globalOrders.filter(o =>
    o.order_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    o.customer_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Calculate metrics
  const activeTenants = tenants.filter(t => t.is_active);
  const inactiveTenants = tenants.filter(t => !t.is_active);
  const topTenants = activeTenants.slice(0, 5);


  return (
    <div className="space-y-6">
      {/* Header with Search */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard Global</h1>
          <p className="text-gray-600 mt-1">Vista completa de toda la plataforma VentIA</p>
        </div>
        <div className="flex gap-2 max-w-md w-full md:w-auto">
          <Input
            placeholder="Buscar tenant, orden, usuario..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1"
          />
          <Button variant="outline" size="icon">
            <Search className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <p className="text-red-800">Error: {error}</p>
          </CardContent>
        </Card>
      )}

      {/* Loading State */}
      {loading && (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="space-y-0 pb-2">
                <div className="h-4 bg-gray-200 rounded w-24"></div>
              </CardHeader>
              <CardContent>
                <div className="h-8 bg-gray-200 rounded w-16 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-32"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Platform Stats */}
      {!loading && platformStats && (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card className="hover:shadow-lg transition-shadow border-l-4 border-l-blue-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Empresas Activas
              </CardTitle>
              <Building2 className="h-5 w-5 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{platformStats.total_tenants}</div>
              <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                <TrendingUp className="h-3 w-3 text-green-600" />
                {inactiveTenants.length} inactivos
              </p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow border-l-4 border-l-green-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Total Usuarios
              </CardTitle>
              <Users className="h-5 w-5 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{platformStats.total_users}</div>
              <p className="text-xs text-gray-500 mt-1">
                En {platformStats.total_tenants} organizaciones
              </p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow border-l-4 border-l-purple-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                API Keys Activas
              </CardTitle>
              <Key className="h-5 w-5 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{platformStats.active_api_keys}</div>
              <p className="text-xs text-gray-500 mt-1">
                Credenciales en uso
              </p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow border-l-4 border-l-orange-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Super Admins
              </CardTitle>
              <Shield className="h-5 w-5 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{platformStats.total_super_admins}</div>
              <p className="text-xs text-gray-500 mt-1">
                Administradores de sistema
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content Grid */}
      {!loading && (
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Top Tenants */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-blue-600" />
                    Top Tenants
                  </CardTitle>
                  <CardDescription>Organizaciones más activas</CardDescription>
                </div>
                <Button variant="ghost" size="sm" asChild>
                  <a href="/superadmin/tenants">
                    Ver todos <ArrowUpRight className="ml-1 h-4 w-4" />
                  </a>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {inactiveTenants.length > 0 && (
                <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-center gap-2 text-yellow-800">
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
                    className="flex items-center justify-between p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer"
                    onClick={() => window.location.href = `/superadmin/tenants`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                        <Building2 className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{tenant.name}</p>
                        <p className="text-xs text-gray-500">@{tenant.slug}</p>
                      </div>
                    </div>
                    <Badge variant={tenant.is_active ? "default" : "secondary"}>
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
                  <CardTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5 text-orange-600" />
                    Órdenes Recientes Globales
                  </CardTitle>
                  <CardDescription>Últimas órdenes de todos los tenants</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {(searchTerm ? filteredOrders : globalOrders).slice(0, 8).map((order) => (
                  <div
                    key={order.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className={`p-2 rounded-lg ${order.status === 'Pagado' ? 'bg-green-100' : 'bg-yellow-100'
                        }`}>
                        {order.status === 'Pagado' ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        ) : (
                          <Clock className="h-4 w-4 text-yellow-600" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm">#{order.order_number}</p>
                          <Badge variant="outline" className="text-xs">
                            {order.tenant_name || `Tenant ${order.tenant_id}`}
                          </Badge>
                        </div>
                        <p className="text-xs text-gray-600 truncate">{order.customer_name}</p>
                      </div>
                    </div>
                    <div className="text-right ml-4">
                      <p className="font-semibold text-sm">
                        {order.currency} {order.total?.toFixed(2) || '0.00'}
                      </p>
                      <Badge
                        variant={order.status === 'Pagado' ? "default" : "secondary"}
                        className="text-xs mt-1"
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
      )}

      {/* Activity Feed */}
      {!loading && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-blue-600" />
              <div>
                <CardTitle>Actividad en Tiempo Real</CardTitle>
                <CardDescription>Eventos recientes en la plataforma</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 md:grid-cols-2">
              {activities.map((activity) => {
                const getIcon = () => {
                  const type = activity.entity_type.toLowerCase();
                  if (type === 'user') return <Users className="h-4 w-4" />;
                  if (type === 'tenant') return <Building2 className="h-4 w-4" />;
                  if (type === 'api_key') return <Key className="h-4 w-4" />;
                  return <Activity className="h-4 w-4" />;
                };

                const getColor = () => {
                  const type = activity.entity_type.toLowerCase();
                  if (type === 'user') return 'bg-green-100 text-green-700';
                  if (type === 'tenant') return 'bg-blue-100 text-blue-700';
                  if (type === 'api_key') return 'bg-purple-100 text-purple-700';
                  return 'bg-gray-100 text-gray-700';
                };

                const translateOperation = (operation: string) => {
                  const translations: Record<string, string> = {
                    'CREATED': 'Creado',
                    'UPDATED': 'Actualizado',
                    'DELETED': 'Eliminado',
                    'LOGGED_IN': 'Inicio de sesión',
                    'LOGGED_OUT': 'Cierre de sesión',
                  };
                  return translations[operation] || operation;
                };

                return (
                  <div key={activity.id} className="flex items-start gap-3 p-3 rounded-lg bg-gray-50">
                    <div className={`p-2 rounded-full ${getColor()}`}>
                      {getIcon()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {activity.description}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">
                          {translateOperation(activity.operation)}
                        </Badge>
                        <span className="text-xs text-gray-500">
                          {new Date(activity.timestamp).toLocaleString('es-ES', {
                            day: '2-digit',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      {!loading && (
        <Card>
          <CardHeader>
            <CardTitle>Acciones Rápidas</CardTitle>
            <CardDescription>Gestión y administración de la plataforma</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4">
              <Button variant="outline" className="h-20 flex-col gap-2" asChild>
                <a href="/superadmin/tenants">
                  <Building2 className="h-6 w-6 text-blue-600" />
                  <span className="text-sm font-medium">Gestionar Tenants</span>
                </a>
              </Button>
              <Button variant="outline" className="h-20 flex-col gap-2" asChild>
                <a href="/superadmin/users">
                  <Users className="h-6 w-6 text-green-600" />
                  <span className="text-sm font-medium">Gestionar Usuarios</span>
                </a>
              </Button>
              <Button variant="outline" className="h-20 flex-col gap-2" asChild>
                <a href="/superadmin/api-keys">
                  <Key className="h-6 w-6 text-purple-600" />
                  <span className="text-sm font-medium">API Keys</span>
                </a>
              </Button>
              <Button variant="outline" className="h-20 flex-col gap-2" asChild>
                <a href="/dashboard/get-started">
                  <Activity className="h-6 w-6 text-orange-600" />
                  <span className="text-sm font-medium">Ver Dashboard</span>
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

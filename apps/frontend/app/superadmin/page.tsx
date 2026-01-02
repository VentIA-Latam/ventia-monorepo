"use client";

import { useEffect, useState } from "react";
import { Building2, Users, Key, Shield } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getPlatformStats, getRecentActivity, type PlatformStats, type Activity } from "@/lib/services/stats";
import { useRouter } from "next/navigation";

export default function SuperAdminDashboard() {
  const router = useRouter();
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch stats and activities in parallel
        const [statsData, activityData] = await Promise.all([
          getPlatformStats(),
          getRecentActivity(5),
        ]);

        setStats(statsData);
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

  const statsCards = stats ? [
    {
      title: "Total Tenants",
      value: stats.total_tenants.toString(),
      description: "Activos en la plataforma",
      icon: Building2,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      title: "Total Usuarios",
      value: stats.total_users.toString(),
      description: "Usuarios registrados",
      icon: Users,
      color: "text-green-600",
      bgColor: "bg-green-50",
    },
    {
      title: "API Keys Activas",
      value: stats.active_api_keys.toString(),
      description: "Claves de API en uso",
      icon: Key,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
    },
    {
      title: "Super Admins",
      value: stats.total_super_admins.toString(),
      description: "Administradores del sistema",
      icon: Shield,
      color: "text-orange-600",
      bgColor: "bg-orange-50",
    },
  ] : [];

  const getActivityIcon = (entityType: string) => {
    const entityLower = entityType.toLowerCase();
    if (entityLower === 'tenant') {
      return { icon: Building2, color: "bg-blue-100 text-blue-600" };
    }
    if (entityLower === 'user') {
      return { icon: Users, color: "bg-green-100 text-green-600" };
    }
    if (entityLower === 'api_key' || entityLower === 'apikey') {
      return { icon: Key, color: "bg-purple-100 text-purple-600" };
    }
    if (entityLower === 'order') {
      return { icon: Shield, color: "bg-orange-100 text-orange-600" };
    }
    return { icon: Shield, color: "bg-gray-100 text-gray-600" };
  };

  const formatRelativeTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return "Hace un momento";
    if (diffInSeconds < 3600) return `Hace ${Math.floor(diffInSeconds / 60)} minutos`;
    if (diffInSeconds < 86400) return `Hace ${Math.floor(diffInSeconds / 3600)} horas`;
    if (diffInSeconds < 604800) return `Hace ${Math.floor(diffInSeconds / 86400)} días`;
    return date.toLocaleDateString();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Panel de SuperAdmin</h1>
        <p className="text-gray-600 mt-2">
          Administración global de la plataforma VentIA
        </p>
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

      {/* Stats Grid */}
      {!loading && stats && (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {statsCards.map((stat) => {
            const Icon = stat.icon;
            return (
              <Card key={stat.title} className="hover:shadow-lg transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">
                    {stat.title}
                  </CardTitle>
                  <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                    <Icon className={`h-4 w-4 ${stat.color}`} />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-gray-900">{stat.value}</div>
                  <p className="text-xs text-gray-500 mt-1">{stat.description}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Recent Activity Section */}
      {!loading && (
        <Card>
          <CardHeader>
            <CardTitle>Actividad Reciente</CardTitle>
            <CardDescription>
              Últimas acciones realizadas en la plataforma
            </CardDescription>
          </CardHeader>
          <CardContent>
            {activities.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">
                No hay actividad reciente
              </p>
            ) : (
              <div className="space-y-4">
                {activities.map((activity) => {
                  const { icon: Icon, color } = getActivityIcon(activity.entity_type);
                  return (
                    <div key={activity.id} className="flex items-center gap-4 p-4 rounded-lg bg-gray-50">
                      <div className={`h-10 w-10 rounded-full flex items-center justify-center ${color}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-gray-900">
                            {activity.description}
                          </p>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${activity.operation === 'CREATED'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-blue-100 text-blue-700'
                            }`}>
                            {activity.operation}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          {formatRelativeTime(activity.timestamp)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Acciones Rápidas</CardTitle>
          <CardDescription>
            Operaciones comunes de administración
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <a
              href="/superadmin/tenants"
              className="flex items-center gap-3 p-4 rounded-lg border-2 border-dashed border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-all cursor-pointer"
            >
              <Building2 className="h-6 w-6 text-blue-600" />
              <div>
                <p className="font-semibold text-gray-900">Crear Tenant</p>
                <p className="text-xs text-gray-500">Agregar nueva organización</p>
              </div>
            </a>

            <a
              href="/superadmin/users"
              className="flex items-center gap-3 p-4 rounded-lg border-2 border-dashed border-gray-200 hover:border-green-400 hover:bg-green-50 transition-all cursor-pointer"
            >
              <Users className="h-6 w-6 text-green-600" />
              <div>
                <p className="font-semibold text-gray-900">Gestionar Usuarios</p>
                <p className="text-xs text-gray-500">Ver todos los usuarios</p>
              </div>
            </a>

            <a
              href="/superadmin/api-keys"
              className="flex items-center gap-3 p-4 rounded-lg border-2 border-dashed border-gray-200 hover:border-purple-400 hover:bg-purple-50 transition-all cursor-pointer"
            >
              <Key className="h-6 w-6 text-purple-600" />
              <div>
                <p className="font-semibold text-gray-900">API Keys</p>
                <p className="text-xs text-gray-500">Administrar credenciales</p>
              </div>
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

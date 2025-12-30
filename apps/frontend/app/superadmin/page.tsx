import { Building2, Users, Key, Shield } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function SuperAdminDashboard() {
  // Mock data - esto se reemplazará con datos reales del backend
  const stats = [
    {
      title: "Total Tenants",
      value: "12",
      description: "Activos en la plataforma",
      icon: Building2,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      title: "Total Usuarios",
      value: "48",
      description: "Usuarios registrados",
      icon: Users,
      color: "text-green-600",
      bgColor: "bg-green-50",
    },
    {
      title: "API Keys Activas",
      value: "8",
      description: "Claves de API en uso",
      icon: Key,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
    },
    {
      title: "Super Admins",
      value: "3",
      description: "Administradores del sistema",
      icon: Shield,
      color: "text-orange-600",
      bgColor: "bg-orange-50",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Panel de SuperAdmin</h1>
        <p className="text-gray-600 mt-2">
          Administración global de la plataforma VentIA
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
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

      {/* Recent Activity Section */}
      <Card>
        <CardHeader>
          <CardTitle>Actividad Reciente</CardTitle>
          <CardDescription>
            Últimas acciones realizadas en la plataforma
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-4 p-4 rounded-lg bg-gray-50">
              <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                <Building2 className="h-5 w-5 text-blue-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">
                  Nuevo tenant creado: &quot;Acme Corp&quot;
                </p>
                <p className="text-xs text-gray-500">Hace 2 horas</p>
              </div>
            </div>

            <div className="flex items-center gap-4 p-4 rounded-lg bg-gray-50">
              <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                <Users className="h-5 w-5 text-green-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">
                  Usuario &quot;john@example.com&quot; actualizado
                </p>
                <p className="text-xs text-gray-500">Hace 5 horas</p>
              </div>
            </div>

            <div className="flex items-center gap-4 p-4 rounded-lg bg-gray-50">
              <div className="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center">
                <Key className="h-5 w-5 text-purple-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">
                  Nueva API Key generada para &quot;TechStart&quot;
                </p>
                <p className="text-xs text-gray-500">Hace 1 día</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

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

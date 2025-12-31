import { Building2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function TenantsPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Gestión de Tenants</h1>
          <p className="text-gray-600 mt-2">
            Administra todas las organizaciones de la plataforma
          </p>
        </div>
        <Button className="bg-blue-600 hover:bg-blue-700">
          <Plus className="mr-2 h-4 w-4" />
          Nuevo Tenant
        </Button>
      </div>

      {/* Coming Soon Card */}
      <Card>
        <CardHeader>
          <CardTitle>🚧 En Desarrollo</CardTitle>
          <CardDescription>
            Esta funcionalidad estará disponible pronto
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <Building2 className="h-16 w-16 text-gray-300" />
            <div className="text-center space-y-2">
              <p className="text-lg font-semibold text-gray-600">
                Gestión de Tenants
              </p>
              <p className="text-sm text-gray-500 max-w-md">
                Aquí podrás crear, editar y eliminar tenants. También podrás gestionar
                sus configuraciones, usuarios asociados y credenciales de Shopify.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

import { Key, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function ApiKeysPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Gestión de API Keys</h1>
          <p className="text-gray-600 mt-2">
            Administra las credenciales de API de los tenants
          </p>
        </div>
        <Button className="bg-purple-600 hover:bg-purple-700">
          <Plus className="mr-2 h-4 w-4" />
          Nueva API Key
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
            <Key className="h-16 w-16 text-gray-300" />
            <div className="text-center space-y-2">
              <p className="text-lg font-semibold text-gray-600">
                Gestión de API Keys
              </p>
              <p className="text-sm text-gray-500 max-w-md">
                Aquí podrás generar, visualizar y revocar API Keys para los tenants.
                También podrás gestionar las credenciales encriptadas de Shopify.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

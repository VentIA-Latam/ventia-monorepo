import { fetchApiKeys } from "@/lib/services/superadmin-service";
import { ApiKeysClient } from "./api-keys-client";

export const dynamic = "force-dynamic";

export default async function SuperAdminAPIKeysPage() {
  try {
    const data = await fetchApiKeys({ limit: 10 });

    return (
      <ApiKeysClient
        initialApiKeys={data.items}
        initialTotal={data.total ?? 0}
      />
    );
  } catch (error) {
    console.error("Error loading API keys:", error);
    return (
      <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-lg">
        <p className="font-semibold">Error al cargar API Keys</p>
        <p className="text-sm">
          {error instanceof Error ? error.message : "Error desconocido"}
        </p>
      </div>
    );
  }
}

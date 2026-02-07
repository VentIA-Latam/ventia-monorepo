import { fetchTenants } from "@/lib/services/superadmin-service";
import { TenantsClient } from "./tenants-client";

export default async function TenantsPage() {
  const tenantsData = await fetchTenants({ limit: 100 });

  return <TenantsClient initialTenants={tenantsData.items} />;
}


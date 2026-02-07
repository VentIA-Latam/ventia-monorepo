import { fetchUsers, fetchTenants } from "@/lib/services/superadmin-service";
import { UsersClient } from "./users-client";

export default async function UsersPage() {
  const [usersData, tenantsData] = await Promise.all([
    fetchUsers({ limit: 100 }),
    fetchTenants({ limit: 100 }),
  ]);

  return (
    <UsersClient
      initialUsers={usersData.items}
      tenants={tenantsData.items}
    />
  );
}

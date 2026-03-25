import { redirect } from "next/navigation";
import { getAccessToken } from "@/lib/auth0";
import { getCurrentUser } from "@/lib/services/user-service";
import { fetchTenants } from "@/lib/services/superadmin-service";
import SuperAdminLayoutClient from "./superadmin-layout-client";

export default async function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const token = await getAccessToken();
  if (!token) redirect("/auth/login");

  // Parallel fetch: user + tenants (async-parallel)
  const [user, tenantsResult] = await Promise.all([
    getCurrentUser(token),
    fetchTenants({ limit: 200 }).catch((err) => { console.error("fetchTenants error:", err); return { items: [] }; }),
  ]);

  const role = user.role?.toUpperCase();

  // Only SUPERADMIN can access this panel
  if (role !== "SUPERADMIN" && role !== "SUPER_ADMIN") {
    redirect("/dashboard");
  }

  const tenants = (tenantsResult?.items ?? [])
    .filter((t: { is_platform?: boolean }) => !t.is_platform)
    .map((t: { id: number; name: string }) => ({ id: t.id, name: t.name }));

  return (
    <SuperAdminLayoutClient tenants={tenants}>
      {children}
    </SuperAdminLayoutClient>
  );
}


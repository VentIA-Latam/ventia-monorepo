import { redirect } from "next/navigation";
import { getAccessToken } from "@/lib/auth0";
import { getCurrentUser } from "@/lib/services/user-service";
import SuperAdminLayoutClient from "./superadmin-layout-client";

export default async function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const token = await getAccessToken();
  if (!token) redirect("/auth/login");

  const user = await getCurrentUser(token);
  const role = user.role?.toUpperCase();

  // Only SUPERADMIN can access this panel
  if (role !== "SUPERADMIN" && role !== "SUPER_ADMIN") {
    redirect("/dashboard");
  }

  return <SuperAdminLayoutClient>{children}</SuperAdminLayoutClient>;
}

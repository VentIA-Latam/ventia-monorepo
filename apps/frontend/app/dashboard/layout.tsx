import { redirect } from "next/navigation";
import { getAccessToken } from "@/lib/auth0";
import { getCurrentUser } from "@/lib/services/user-service";
import DashboardLayoutClient from "./dashboard-layout-client";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const token = await getAccessToken();
  if (!token) redirect("/auth/login");

  const user = await getCurrentUser(token);
  const role = user.role?.toUpperCase();

  // SUPERADMIN should not be in /dashboard — redirect to superadmin panel
  if (role === "SUPERADMIN" || role === "SUPER_ADMIN") {
    redirect("/superadmin");
  }

  const timezone = user.tenant?.timezone || "America/Lima";

  return <DashboardLayoutClient timezone={timezone}>{children}</DashboardLayoutClient>;
}


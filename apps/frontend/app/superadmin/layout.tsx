"use client";

import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { SuperAdminSidebar } from "@/components/superadmin/superadmin-sidebar"
import { Separator } from "@/components/ui/separator"
import { usePathname } from "next/navigation"

export default function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const getPageTitle = () => {
    if (pathname === '/superadmin') return 'Dashboard SuperAdmin';
    if (pathname.includes('/tenants')) return 'Gestión de Tenants';
    if (pathname.includes('/users')) return 'Gestión de Usuarios';
    if (pathname.includes('/api-keys')) return 'Gestión de API Keys';
    return 'SuperAdmin';
  };

  return (
    <SidebarProvider>
      <SuperAdminSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator
              orientation="vertical"
              className="mr-2 data-[orientation=vertical]:h-4"
            />
            <h2 className="text-lg font-semibold text-gray-800 font-libre-franklin">
              {getPageTitle()}
            </h2>
          </div>
        </header>
        <div className="flex flex-1 flex-col gap-6 px-2 md:px-8 lg:px-16 py-6">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

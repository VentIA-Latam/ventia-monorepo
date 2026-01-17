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
        <header className="flex h-14 md:h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12 border-b border-gray-100">
          <div className="flex items-center gap-2 px-3 md:px-4 w-full">
            <SidebarTrigger className="-ml-1" />
            <Separator
              orientation="vertical"
              className="mr-2 data-[orientation=vertical]:h-4"
            />
            <h2 className="text-base md:text-lg font-semibold text-gray-800 font-libre-franklin truncate">
              {getPageTitle()}
            </h2>
          </div>
        </header>
        <div className="flex flex-1 flex-col gap-4 md:gap-6 px-3 sm:px-4 md:px-6 lg:px-12 xl:px-16 py-4 md:py-6">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

"use client";

import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/dashboard/app-sidebar"
import { Separator } from "@/components/ui/separator"
import { usePathname } from "next/navigation"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const getPageTitle = () => {
    if (pathname.includes('/assistant')) return 'Configuración de tu vendedor';
    if (pathname.includes('/products')) return 'Productos';
    if (pathname.includes('/conversations')) return 'Conversaciones';
    if (pathname.includes('/metrics')) return 'Métricas';
    if (pathname.includes('/get-started')) return 'Inicio';
    if (pathname.includes('/payments')) return 'Pagos';
    if (pathname.includes('/invoices')) return 'Facturación';
    return 'Dashboard';
  };

  return (
    <SidebarProvider>
      <AppSidebar />
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

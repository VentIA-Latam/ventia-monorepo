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
        <header className="flex h-14 sm:h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12 border-b">
          <div className="flex items-center gap-2 px-3 sm:px-4 w-full">
            <SidebarTrigger className="-ml-1" />
            <Separator
              orientation="vertical"
              className="mr-2 data-[orientation=vertical]:h-4"
            />
            <h2 className="text-base sm:text-lg font-semibold text-gray-800 font-libre-franklin truncate">
              {getPageTitle()}
            </h2>
          </div>
        </header>
        <div className="flex flex-1 flex-col gap-4 sm:gap-6 px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6 overflow-x-hidden">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

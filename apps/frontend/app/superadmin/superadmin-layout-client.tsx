"use client";

import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { SuperAdminSidebar } from "@/components/superadmin/superadmin-sidebar"
import { Separator } from "@/components/ui/separator"
import { usePathname } from "next/navigation"

export default function SuperAdminLayoutClient({
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
    if (pathname.includes('/invoices-series')) return 'Series de facturación';
    if (pathname.includes('/invoices/new')) return 'Nuevo Comprobante';
    if (pathname.match(/\/invoices\/\d+/)) return 'Detalle de Comprobante';
    if (pathname === '/superadmin/invoices') return 'Facturación';
    if (pathname.match(/\/orders\/\d+/)) return 'Detalle de Pedido';
    if (pathname === '/superadmin/orders') return 'Pedidos';
    if (pathname.includes('/settings/api-keys')) return 'Credenciales (API Key)';
    if (pathname.includes('/chatwoot')) return 'Chatwoot';
    return 'SuperAdmin';
  };

  return (
    <SidebarProvider>
      <SuperAdminSidebar />
      <SidebarInset>
        <header className="flex h-14 md:h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12 border-b border-border">
          <div className="flex items-center gap-2 px-3 md:px-4 w-full group-has-data-[collapsible=icon]/sidebar-wrapper:ml-5">
            <SidebarTrigger className="-ml-1" />
            <Separator
              orientation="vertical"
              className="mr-2 data-[orientation=vertical]:h-4"
            />
            <h2 className="text-base md:text-lg font-semibold text-foreground font-heading truncate">
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


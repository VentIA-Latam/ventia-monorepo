"use client";

import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/dashboard/app-sidebar"
import { Separator } from "@/components/ui/separator"
import { usePathname } from "next/navigation"
import { ChevronRight, Home } from "lucide-react"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"

const PAGE_META: Record<string, { title: string; breadcrumb: string[] }> = {
  '/assistant': { title: 'Configuración de tu vendedor', breadcrumb: ['Asistente'] },
  '/products': { title: 'Productos', breadcrumb: ['Productos'] },
  '/conversations': { title: 'Conversaciones', breadcrumb: ['Conversaciones'] },
  '/campaigns': { title: 'Campañas', breadcrumb: ['Campañas'] },
  '/agent-customization': { title: 'Personalización del Agente', breadcrumb: ['Personalización'] },
  '/metrics': { title: 'Métricas', breadcrumb: ['Métricas'] },
  '/whatsapp-connect': { title: 'Conectar WhatsApp', breadcrumb: ['WhatsApp'] },
  '/get-started': { title: 'Inicio', breadcrumb: [] },
  '/payments': { title: 'Pagos', breadcrumb: ['Pagos'] },
  '/invoices-series': { title: 'Series de facturación', breadcrumb: ['Facturación', 'Series'] },
  '/invoices/new': { title: 'Nuevo Comprobante', breadcrumb: ['Facturación', 'Nuevo'] },
  '/invoices': { title: 'Facturación', breadcrumb: ['Facturación'] },
  '/orders': { title: 'Pedidos', breadcrumb: ['Pedidos'] },
  '/settings/api-keys': { title: 'Credenciales (API Key)', breadcrumb: ['Configuración', 'API Keys'] },
}

function getPageMeta(pathname: string) {
  // Check most specific paths first (longer paths)
  const sorted = Object.entries(PAGE_META).sort((a, b) => b[0].length - a[0].length)
  for (const [path, meta] of sorted) {
    if (pathname.includes(path)) return meta
  }
  // Dynamic order detail
  if (/\/orders\/\d+/.test(pathname)) {
    return { title: 'Detalle del Pedido', breadcrumb: ['Pedidos', 'Detalle'] }
  }
  // Dynamic invoice detail
  if (/\/invoices\/\d+/.test(pathname)) {
    return { title: 'Detalle del Comprobante', breadcrumb: ['Facturación', 'Detalle'] }
  }
  return { title: 'Dashboard', breadcrumb: [] }
}

export default function DashboardLayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { title, breadcrumb } = getPageMeta(pathname);

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-14 sm:h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12 border-b bg-gradient-to-r from-cielo/10 to-transparent">
          <div className="flex items-center gap-2 px-3 sm:px-4 w-full">
            <SidebarTrigger className="-ml-1" />
            <Separator
              orientation="vertical"
              className="mr-2 data-[orientation=vertical]:h-4"
            />
            <div className="flex flex-col min-w-0">
              <h2 className="text-base sm:text-lg font-semibold text-foreground font-heading truncate">
                {title}
              </h2>
              {breadcrumb.length > 0 && (
                <nav className="flex items-center gap-1 text-xs text-muted-foreground -mt-0.5">
                  <Link href="/dashboard/get-started" className="hover:text-foreground transition-colors">
                    <Home className="h-3 w-3" />
                  </Link>
                  {breadcrumb.map((item, i) => (
                    <span key={item} className="flex items-center gap-1">
                      <ChevronRight className="h-3 w-3" />
                      <span className={i === breadcrumb.length - 1 ? "text-foreground font-medium" : ""}>
                        {item}
                      </span>
                    </span>
                  ))}
                </nav>
              )}
            </div>
          </div>
        </header>
        <div className="flex flex-1 flex-col gap-4 sm:gap-6 px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6 overflow-x-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="flex flex-1 flex-col gap-4 sm:gap-6"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

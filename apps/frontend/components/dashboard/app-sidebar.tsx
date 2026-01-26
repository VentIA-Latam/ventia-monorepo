"use client"

import * as React from "react"
import {
  Settings,
  HelpCircle,
  ChevronsUpDown,
  LogOut,
  Bell,
  Moon,
  ChevronRight,
  CreditCard,
  Users,
  LayoutDashboard,
  ShoppingCart,
  Bot,
  Shield,
  Key,
  Receipt,
  FileBarChart,
} from "lucide-react"
import { usePathname } from "next/navigation"
import Image from "next/image"
import { useAuth } from "@/hooks/use-auth"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"

const dataPlatform = [
  {
    title: "Dashboard",
    url: "/dashboard/get-started",
    icon: LayoutDashboard,
    badge: "0%",
  },
  {
    title: "Pedidos",
    url: "/dashboard/orders",
    icon: ShoppingCart,
    hasSubmenu: true,
  },
  {
    title: "Facturación",
    url: "/dashboard/invoices",
    icon: Receipt,
  },
  /*   {
      title: "Clientes",
      url: "/dashboard/clients",
      icon: Users,
      locked: true,
    }, */
  // {
  //   title: "Pagos",
  //   url: "/dashboard/payments",
  //   icon: CreditCard,
  // },
  /*   {
      title: "Mi vendedor",
      url: "/dashboard/assistant",
      icon: Bot,
    }, */
]

const dataConfiguration = [
  {
    title: "Series de facturación",
    url: "/dashboard/invoices/series",
    icon: FileBarChart,
  },
  {
    title: "Credenciales (API Key)",
    url: "/dashboard/settings/api-keys",
    icon: Key,
  },
]

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname()
  const { user, isLoading, isSuperAdmin } = useAuth()

  const isActive = (url: string) => {
    if (url === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(url);
  };

  const handleLogout = () => {
    window.location.href = "/auth/logout";
  };

  // Get user initials for avatar fallback
  const getUserInitials = () => {
    if (!user?.name) return "U";
    return user.name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Sidebar collapsible="icon" className="bg-white border-r border-gray-100 [--sidebar-width-icon:4.5rem]" {...props}>

      {/* --- HEADER con LOGO DINÁMICO --- */}
      <SidebarHeader className="h-16 flex items-center justify-between px-4 border-b border-transparent" suppressHydrationWarning>
        {/* Versión colapsada - visible solo cuando el sidebar está colapsado */}
        <div className="hidden group-data-[state=collapsed]:flex items-center justify-center w-full py-3">
          <div className="relative h-14 w-14">
            <Image
              src="/images/logo-ventia-celeste.png"
              alt="VentIA"
              fill
              className="object-contain"
            />
          </div>
        </div>

        {/* Versión expandida - visible solo cuando el sidebar está expandido */}
        <div className="flex group-data-[state=collapsed]:hidden items-center justify-between w-full">
          <div className="relative h-8 w-32">
            <Image
              src="/images/logo-ventia-sidebar.png"
              alt="VentIA"
              fill
              className="object-contain"
            />
          </div>

          {/* Iconos de herramientas (solo visibles expandido) */}
          {/*           <div className="flex gap-3 text-gray-400">
            <Bell className="w-5 h-5 cursor-pointer hover:text-gray-700 transition-colors" />
            <Moon className="w-5 h-5 cursor-pointer hover:text-gray-700 transition-colors" />
          </div> */}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-3 py-2 font-inter">
        {/* --- GRUPO PLATAFORMA --- */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-gray-500 text-xs font-medium uppercase tracking-wider mb-2 px-2">
            Plataforma
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {dataPlatform.map((item) => (
                <SidebarMenuItem key={item.title} className="mb-1">
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.url)}
                    tooltip={item.title}
                    className={`
                        w-full justify-between h-10 px-3 rounded-lg transition-all duration-200
                        ${isActive(item.url) ? "border border-sidebar-border shadow-sm" : ""}
                    `}
                  >
                    <a href={item.url} className="flex items-center w-full">
                      <item.icon className="w-5 h-5 mr-3 shrink-0" />
                      <span className="flex-1 truncate">{item.title}</span>

                      {/*                       
                      {item.badge && (
                        <span className="text-[10px] font-bold bg-sidebar-primary/10 text-sidebar-primary px-1.5 py-0.5 rounded-full ml-auto group-data-[collapsible=icon]:hidden">
                          {item.badge}
                        </span>
                      )} */}
                      {/*                       {item.hasSubmenu && (
                        <ChevronRight className="w-4 h-4 text-gray-400 ml-auto group-data-[collapsible=icon]:hidden" />
                      )} */}
                      {/*                       
                      {item.locked && (
                        <span className="text-gray-400 text-xs ml-auto group-data-[collapsible=icon]:hidden">🔒</span>
                      )} */}
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* --- GRUPO CUENTA --- */}
        {/*         
        <SidebarGroup className="mt-4">
          <SidebarGroupLabel className="text-gray-500 text-xs font-medium uppercase tracking-wider mb-2 px-2">
            Cuenta
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <Collapsible defaultOpen className="group/collapsible" suppressHydrationWarning>
                <SidebarMenuItem suppressHydrationWarning>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton
                      tooltip="Configuraciones"
                      className="w-full justify-between h-10 px-3 rounded-lg text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
                    >
                      <div className="flex items-center">
                        <Settings className="w-5 h-5 mr-3 text-gray-500" />
                        <span>Configuraciones</span>
                      </div>
                      <ChevronRight className="ml-auto size-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90 text-gray-400" />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>

                  <CollapsibleContent>
                    <div className="ml-9 mt-1 pl-3 border-l-2 border-yellow-400 bg-yellow-50/50 rounded-r-md p-3 space-y-2 group-data-[collapsible=icon]:hidden">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700">Canales</span>
                        <button className="text-[10px] bg-yellow-500 hover:bg-yellow-600 text-white px-2 py-1 rounded-full font-bold transition-colors">
                          Conectar What...
                        </button>
                      </div>
                      <div className="text-xs text-gray-500 flex items-center gap-1">
                        <span>Idioma:</span>
                        <span className="text-gray-700 font-semibold uppercase">ES Español</span>
                      </div>
                    </div>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>

              <SidebarMenuItem className="mt-4">
                <SidebarMenuButton
                  asChild
                  tooltip="Soporte"
                  className="w-full justify-start h-10 px-3 rounded-lg text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
                >
                  <a href="#">
                    <HelpCircle className="w-5 h-5 mr-3 text-gray-500" />
                    <span>Soporte</span>
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>

            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup> 
        */}
      </SidebarContent>

      {/* --- FOOTER (PERFIL) --- */}
      <SidebarFooter className="p-4 border-t border-gray-100 bg-white">
        <SidebarMenu>
          <SidebarMenuItem suppressHydrationWarning>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-gray-50 data-[state=open]:text-gray-900 w-full hover:bg-gray-50 rounded-xl transition-colors p-2 border border-transparent hover:border-gray-100"
                >
                  <Avatar className="h-10 w-10 rounded-full bg-gray-100 border border-gray-200">
                    <AvatarImage src={user?.picture || ""} alt={user?.name || "User"} />
                    <AvatarFallback className="bg-gray-200 text-gray-600 font-medium text-sm">
                      {isLoading ? "..." : getUserInitials()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight ml-3 group-data-[collapsible=icon]:hidden">
                    <span className="truncate font-bold text-gray-800">
                      {isLoading ? "Cargando..." : user?.name || "Usuario"}
                    </span>
                    <span className="truncate text-xs text-gray-500">
                      {isLoading ? "" : user?.email || ""}
                    </span>
                  </div>
                  <ChevronsUpDown className="ml-auto size-4 text-gray-400 group-data-[collapsible=icon]:hidden" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-xl shadow-lg border-gray-100"
                side="bottom"
                align="end"
                sideOffset={8}
              >
                <DropdownMenuLabel className="p-0 font-normal">
                  <div className="flex items-center gap-3 px-3 py-2.5 text-left text-sm">
                    <Avatar className="h-9 w-9 rounded-full bg-gray-100 border border-gray-200">
                      <AvatarImage src={user?.picture || ""} alt={user?.name || "User"} />
                      <AvatarFallback className="bg-gray-200 text-gray-600 text-xs font-medium">
                        {getUserInitials()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-bold text-gray-800">{user?.name || "Usuario"}</span>
                      <span className="truncate text-xs text-gray-500">{user?.email || ""}</span>
                    </div>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-gray-100" />
                <DropdownMenuGroup>
                  {isSuperAdmin && (
                    <>
                      <DropdownMenuItem
                        onClick={() => window.location.href = '/superadmin'}
                        className="text-purple-600 focus:text-purple-700 focus:bg-purple-50 cursor-pointer"
                      >
                        <Shield className="mr-2 h-4 w-4" />
                        Panel SuperAdmin
                      </DropdownMenuItem>
                      <DropdownMenuSeparator className="bg-gray-100" />
                    </>
                  )}
                </DropdownMenuGroup>
                <DropdownMenuSeparator className="bg-gray-100" />
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="text-red-600 focus:text-red-700 focus:bg-red-50 cursor-pointer"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Cerrar sesión
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
"use client"

import * as React from "react"
import {
  Settings,
  ChevronsUpDown,
  LogOut,
  Bell,
  LayoutDashboard,
  Users,
  Building2,
  Key,
  Shield,
  ArrowLeft,
  MessageSquare,
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

const dataSuperAdmin = [
  {
    title: "Dashboard",
    url: "/superadmin",
    icon: LayoutDashboard,
  },
  {
    title: "Gestión de Empresas",
    url: "/superadmin/tenants",
    icon: Building2,
  },
  {
    title: "Gestión de Usuarios",
    url: "/superadmin/users",
    icon: Users,
  },
  {
    title: "API Keys",
    url: "/superadmin/api-keys",
    icon: Key,
  },
  {
    title: "Chatwoot",
    url: "/superadmin/chatwoot",
    icon: MessageSquare,
  },
]

export function SuperAdminSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname()
  const { user, isLoading } = useAuth()

  const isActive = (url: string) => {
    if (url === "/superadmin") return pathname === "/superadmin";
    return pathname.startsWith(url);
  };

  const handleLogout = () => {
    window.location.href = "/auth/logout";
  };

  // Get user initials for avatar fallback
  const getUserInitials = () => {
    if (!user?.name) return "SA";
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
              alt="VentIA SuperAdmin"
              fill
              className="object-contain"
            />
          </div>
        </div>

        {/* Versión expandida - visible solo cuando el sidebar está expandido */}
        <div className="flex group-data-[state=collapsed]:hidden items-center justify-between w-full">
          <div className="flex items-center gap-2">
            <div className="relative h-8 w-32">
              <Image
                src="/images/logo-ventia-sidebar.png"
                alt="VentIA SuperAdmin"
                fill
                className="object-contain"
              />
            </div>
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-100 border border-purple-200">
              <Shield className="w-3 h-3 text-purple-600" />
              <span className="text-[10px] font-bold text-purple-600 uppercase">Admin</span>
            </div>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-3 py-2 font-inter">
        {/* --- GRUPO SUPER ADMIN --- */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-gray-500 text-xs font-medium uppercase tracking-wider mb-2 px-2">
            Administración
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {dataSuperAdmin.map((item) => (
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
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
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
                  <Avatar className="h-10 w-10 rounded-full bg-purple-100 border border-purple-200">
                    <AvatarImage src={user?.picture || ""} alt={user?.name || "User"} />
                    <AvatarFallback className="bg-purple-200 text-purple-700 font-medium text-sm">
                      {isLoading ? "..." : getUserInitials()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight ml-3 group-data-[collapsible=icon]:hidden">
                    <span className="truncate font-bold text-gray-800">
                      {isLoading ? "Cargando..." : user?.name || "Usuario"}
                    </span>
                    <span className="truncate text-xs text-purple-600 font-semibold">
                      SUPER ADMIN
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
                    <Avatar className="h-9 w-9 rounded-full bg-purple-100 border border-purple-200">
                      <AvatarImage src={user?.picture || ""} alt={user?.name || "User"} />
                      <AvatarFallback className="bg-purple-200 text-purple-700 text-xs font-medium">
                        {getUserInitials()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-bold text-gray-800">{user?.name || "Usuario"}</span>
                      <span className="truncate text-xs text-purple-600 font-semibold">SUPER ADMIN</span>
                    </div>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-gray-100" />
                {/*                 
                <DropdownMenuGroup>
                  <DropdownMenuItem className="text-gray-600 focus:text-gray-900 cursor-pointer">
                    <Settings className="mr-2 h-4 w-4" />
                    Configuración de cuenta
                  </DropdownMenuItem>
                  <DropdownMenuItem className="text-gray-600 focus:text-gray-900 cursor-pointer">
                    <Bell className="mr-2 h-4 w-4" />
                    Notificaciones
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator className="bg-gray-100" /> */}
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

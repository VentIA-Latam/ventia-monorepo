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
  FileBarChart,
  MessageSquare,
} from "lucide-react"
import { usePathname, useRouter } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
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
]

const dataConfiguration = [
  {
    title: "Series de facturación",
    url: "/superadmin/invoices/series",
    icon: FileBarChart,
  },
  {
    title: "Credenciales",
    url: "/superadmin/api-keys",
    icon: Key,
  },
  {
    title: "Conversaciones",
    url: "/superadmin/conversations",
    icon: MessageSquare,
  },
]

export function SuperAdminSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname()
  const router = useRouter()
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
    <Sidebar collapsible="icon" className="bg-sidebar border-r border-sidebar-border [--sidebar-width-icon:4.5rem]" {...props}>

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
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-luma/15 border border-luma/30">
              <Shield className="w-3 h-3 text-marino" />
              <span className="text-[10px] font-bold text-marino uppercase">Admin</span>
            </div>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-3 py-2 font-sans">
        {/* --- GRUPO SUPER ADMIN --- */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-muted-foreground text-xs font-medium uppercase tracking-wider mb-2 px-2">
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
                        ${isActive(item.url)
                          ? "bg-gradient-to-r from-volt/10 to-aqua/5 border-l-2 border-l-volt shadow-sm"
                          : "hover:bg-muted/60"
                        }
                    `}
                  >
                    <Link href={item.url} className="flex items-center w-full">
                      <item.icon className="w-5 h-5 mr-3 shrink-0" />
                      <span className="flex-1 truncate">{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* --- GRUPO CONFIGURACIÓN --- */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-muted-foreground text-xs font-medium uppercase tracking-wider mb-2 px-2">
            Configuración
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {dataConfiguration.map((item) => (
                <SidebarMenuItem key={item.title} className="mb-1">
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.url)}
                    tooltip={item.title}
                    className={`
                        w-full justify-between h-10 px-3 rounded-lg transition-all duration-200
                        ${isActive(item.url)
                          ? "bg-gradient-to-r from-volt/10 to-aqua/5 border-l-2 border-l-volt shadow-sm"
                          : "hover:bg-muted/60"
                        }
                    `}
                  >
                    <Link href={item.url} className="flex items-center w-full">
                      <item.icon className="w-5 h-5 mr-3 shrink-0" />
                      <span className="flex-1 truncate">{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* --- FOOTER (PERFIL) --- */}
      <SidebarFooter className="p-4 border-t border-sidebar-border bg-gradient-to-t from-cielo/5 to-transparent">
        <SidebarMenu>
          <SidebarMenuItem suppressHydrationWarning>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-muted/50 data-[state=open]:text-foreground w-full hover:bg-muted/50 rounded-xl transition-colors p-2 border border-transparent hover:border-border"
                >
                  <Avatar className="h-10 w-10 rounded-full bg-luma/15 border border-luma/30">
                    <AvatarImage src={user?.picture || ""} alt={user?.name || "User"} />
                    <AvatarFallback className="bg-luma/20 text-marino font-medium text-sm">
                      {isLoading ? "..." : getUserInitials()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight ml-3 group-data-[collapsible=icon]:hidden">
                    <span className="truncate font-bold text-foreground">
                      {isLoading ? "Cargando..." : user?.name || "Usuario"}
                    </span>
                    <span className="truncate text-xs text-marino font-semibold">
                      SUPER ADMIN
                    </span>
                  </div>
                  <ChevronsUpDown className="ml-auto size-4 text-muted-foreground group-data-[collapsible=icon]:hidden" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-xl shadow-lg border-border"
                side="bottom"
                align="end"
                sideOffset={8}
              >
                <DropdownMenuLabel className="p-0 font-normal">
                  <div className="flex items-center gap-3 px-3 py-2.5 text-left text-sm">
                    <Avatar className="h-9 w-9 rounded-full bg-luma/15 border border-luma/30">
                      <AvatarImage src={user?.picture || ""} alt={user?.name || "User"} />
                      <AvatarFallback className="bg-luma/20 text-marino text-xs font-medium">
                        {getUserInitials()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-bold text-foreground">{user?.name || "Usuario"}</span>
                      <span className="truncate text-xs text-marino font-semibold">SUPER ADMIN</span>
                    </div>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-border" />
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="text-danger focus:text-danger focus:bg-danger-bg cursor-pointer"
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

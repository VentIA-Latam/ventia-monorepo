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
  MessageSquare,
} from "lucide-react"
import { usePathname } from "next/navigation"
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
import { Skeleton } from "@/components/ui/skeleton"
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
  {
    title: "Métricas",
    url: "/dashboard/metrics",
    icon: FileBarChart,
  },
  {
    title: "Conversaciones",
    url: "/dashboard/conversations",
    icon: MessageSquare,
  },
  {
    title: "Campañas",
    url: "/dashboard/campaigns",
    icon: Bell,
  },
  {
    title: "Personalización",
    url: "/dashboard/agent-customization",
    icon: Bot,
  },
]

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname()
  const { user, isUserLoading, isSuperAdmin } = useAuth()

  const isActive = (url: string) => {
    if (url === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(url);
  };

  const handleLogout = () => {
    window.location.href = "/auth/logout";
  };

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
    <Sidebar collapsible="icon" className="bg-sidebar border-r border-sidebar-border [--sidebar-width-icon:4.5rem]" {...props}>

      {/* --- HEADER con LOGO DINÁMICO --- */}
      <SidebarHeader className="h-16 flex items-center justify-between px-4 border-b border-transparent" suppressHydrationWarning>
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

        <div className="flex group-data-[state=collapsed]:hidden items-center justify-between w-full">
          <div className="relative h-8 w-32">
            <Image
              src="/images/logo-ventia-sidebar.png"
              alt="VentIA"
              fill
              className="object-contain"
            />
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-3 py-2 font-inter">
        {/* --- GRUPO PLATAFORMA --- */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-muted-foreground text-xs font-medium uppercase tracking-wider mb-2 px-2">
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
      <SidebarFooter className="p-4 border-t border-sidebar-border bg-sidebar">
        <SidebarMenu>
          <SidebarMenuItem suppressHydrationWarning>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-foreground w-full hover:bg-sidebar-accent rounded-xl transition-colors p-2 border border-transparent hover:border-sidebar-border"
                >
                  {isUserLoading ? (
                    <Skeleton className="h-10 w-10 rounded-full" />
                  ) : (
                    <Avatar className="h-10 w-10 rounded-full bg-cielo border border-luma/30">
                      <AvatarImage src={user?.picture || ""} alt={user?.name || "User"} />
                      <AvatarFallback className="bg-cielo text-marino font-medium text-sm">
                        {getUserInitials()}
                      </AvatarFallback>
                    </Avatar>
                  )}
                  <div className="grid flex-1 text-left text-sm leading-tight ml-3 group-data-[collapsible=icon]:hidden">
                    {isUserLoading ? (
                      <>
                        <Skeleton className="h-4 w-24 mb-1" />
                        <Skeleton className="h-3 w-32" />
                      </>
                    ) : (
                      <>
                        <span className="truncate font-bold text-foreground">
                          {user?.name || "Usuario"}
                        </span>
                        <span className="truncate text-xs text-muted-foreground">
                          {user?.email || ""}
                        </span>
                      </>
                    )}
                  </div>
                  <ChevronsUpDown className="ml-auto size-4 text-muted-foreground group-data-[collapsible=icon]:hidden" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-xl shadow-lg border-sidebar-border"
                side="bottom"
                align="end"
                sideOffset={8}
              >
                <DropdownMenuLabel className="p-0 font-normal">
                  <div className="flex items-center gap-3 px-3 py-2.5 text-left text-sm">
                    <Avatar className="h-9 w-9 rounded-full bg-cielo border border-luma/30">
                      <AvatarImage src={user?.picture || ""} alt={user?.name || "User"} />
                      <AvatarFallback className="bg-cielo text-marino text-xs font-medium">
                        {getUserInitials()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-bold text-foreground">{user?.name || "Usuario"}</span>
                      <span className="truncate text-xs text-muted-foreground">{user?.email || ""}</span>
                    </div>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-sidebar-border" />
                <DropdownMenuGroup>
                  {isSuperAdmin && (
                    <>
                      <DropdownMenuItem
                        onClick={() => window.location.href = '/superadmin'}
                        className="text-marino focus:text-marino focus:bg-cielo cursor-pointer"
                      >
                        <Shield className="mr-2 h-4 w-4" />
                        Panel SuperAdmin
                      </DropdownMenuItem>
                      <DropdownMenuSeparator className="bg-sidebar-border" />
                    </>
                  )}
                </DropdownMenuGroup>
                <DropdownMenuSeparator className="bg-sidebar-border" />
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

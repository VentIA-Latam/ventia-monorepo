"use client";

import { useState } from "react";
import { Building2, Plus, Search, MoreHorizontal, Eye, Edit, Power, Store, ShoppingBag, CheckCircle, XCircle } from 'lucide-react';
import { getTenants } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tenant, TenantFilters, EcommercePlatform } from "@/lib/types/tenant";
import { useRouter } from "next/navigation";
import { CreateTenantDialog } from "@/components/superadmin/create-tenant-dialog";
import { EditTenantDialog } from "@/components/superadmin/edit-tenant-dialog";
import { ToggleTenantStatusDialog } from "@/components/superadmin/toggle-tenant-status-dialog";

export function TenantsClient({ initialTenants }: { initialTenants: Tenant[] }) {
  const router = useRouter();
  const [tenants, setTenants] = useState<Tenant[]>(initialTenants);
  const [filters, setFilters] = useState<TenantFilters>({
    search: "",
    status: "all",
    isPlatform: "all",
  });

  // Helper para obtener plataforma del tenant
  const getTenantPlatform = (tenant: Tenant): EcommercePlatform => {
    // Usar ecommerce_settings del backend (nueva forma)
    if (tenant.ecommerce_settings?.platform) {
      return tenant.ecommerce_settings.platform;
    }
    // Fallback a settings legacy
    if (tenant.settings?.ecommerce?.shopify) return "shopify";
    if (tenant.settings?.ecommerce?.woocommerce) return "woocommerce";
    if (tenant.shopify_store_url) return "shopify"; // Fallback legacy
    return null;
  };

  // Helper para obtener URL de la tienda
  const getStoreUrl = (tenant: Tenant): string | null => {
    // Usar ecommerce_settings del backend (nueva forma)
    if (tenant.ecommerce_settings?.store_url) {
      return tenant.ecommerce_settings.store_url;
    }
    // Fallback a settings legacy
    if (tenant.settings?.ecommerce?.shopify) return tenant.settings.ecommerce.shopify.store_url;
    if (tenant.settings?.ecommerce?.woocommerce) return tenant.settings.ecommerce.woocommerce.store_url;
    return tenant.shopify_store_url; // Fallback legacy
  };

  // Helper para obtener estado de sincronizacion
  const getSyncStatus = (tenant: Tenant): boolean => {
    // Usar ecommerce_settings del backend (nueva forma)
    if (tenant.ecommerce_settings) {
      return tenant.ecommerce_settings.sync_on_validation;
    }
    // Fallback a settings legacy
    return tenant.settings?.ecommerce?.sync_on_validation ?? false;
  };

  // Helper para verificar si tiene credenciales
  const hasCredentials = (tenant: Tenant): boolean => {
    return tenant.ecommerce_settings?.has_credentials ?? false;
  };

  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [toggleStatusDialogOpen, setToggleStatusDialogOpen] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);

  // Refresh tenants after mutations (create/edit/toggle)
  const refreshTenants = async () => {
    try {
      const data = await getTenants({ limit: 100 });
      setTenants(data.items || []);
    } catch (error) {
      console.error('Error fetching tenants:', error);
    }
  };

  const filteredTenants = tenants.filter((tenant) => {
    const matchesSearch =
      tenant.name.toLowerCase().includes(filters.search.toLowerCase()) ||
      tenant.slug.toLowerCase().includes(filters.search.toLowerCase());

    const matchesStatus =
      filters.status === "all" ||
      (filters.status === "active" && tenant.is_active) ||
      (filters.status === "inactive" && !tenant.is_active);

    const matchesPlatform =
      filters.isPlatform === "all" ||
      (filters.isPlatform === "platform" && tenant.is_platform) ||
      (filters.isPlatform === "regular" && !tenant.is_platform);

    return matchesSearch && matchesStatus && matchesPlatform;
  });

  const handleViewDetails = (tenantId: number) => {
    router.push(`/superadmin/tenants/${tenantId}`);
  };

  const handleEditTenant = (tenant: Tenant) => {
    setSelectedTenant(tenant);
    setEditDialogOpen(true);
  };

  const handleToggleStatus = (tenant: Tenant) => {
    setSelectedTenant(tenant);
    setToggleStatusDialogOpen(true);
  };

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground font-heading">Gestión de Empresas</h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1 md:mt-2">
            Administra todas las empresas de la plataforma
          </p>
        </div>
        <Button
          className="bg-primary hover:bg-primary/90 w-full sm:w-auto text-sm md:text-base"
          onClick={() => setCreateDialogOpen(true)}
        >
          <Plus className="mr-2 h-4 w-4" />
          Nueva Empresa
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base md:text-lg">Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre o slug..."
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                className="pl-10 text-sm md:text-base"
              />
            </div>
            <Select
              value={filters.status}
              onValueChange={(value) => setFilters({ ...filters, status: value })}
            >
              <SelectTrigger className="text-sm md:text-base">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                <SelectItem value="active">Activos</SelectItem>
                <SelectItem value="inactive">Inactivos</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={filters.isPlatform}
              onValueChange={(value) => setFilters({ ...filters, isPlatform: value })}
            >
              <SelectTrigger className="text-sm md:text-base">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los tipos</SelectItem>
                <SelectItem value="platform">Plataforma</SelectItem>
                <SelectItem value="regular">Regular</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Empresas Table */}
      <Card>
        <CardContent className="p-0">
          {filteredTenants.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Building2 className="h-10 w-10 md:h-12 md:w-12 text-muted-foreground mb-3 md:mb-4" />
              <p className="text-sm md:text-base text-muted-foreground">No se encontraron empresas</p>
            </div>
          ) : (
            <div className="border rounded-lg bg-card shadow-sm overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 border-b border-border">
                    <TableHead className="text-xs md:text-sm min-w-[150px]">NOMBRE</TableHead>
                    <TableHead className="text-xs md:text-sm min-w-[120px]">IDENTIFICADOR</TableHead>
                    <TableHead className="text-xs md:text-sm min-w-[200px]">E-COMMERCE</TableHead>
                    <TableHead className="text-xs md:text-sm min-w-[100px]">TIPO</TableHead>
                    <TableHead className="text-xs md:text-sm min-w-[100px]">ESTADO</TableHead>
                    <TableHead className="text-xs md:text-sm min-w-[100px]">ACCIONES</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTenants.map((tenant) => (
                    <TableRow key={tenant.id} className="hover:bg-cielo/30 transition-colors border-b border-border last:border-0">
                      <TableCell className="font-medium text-xs md:text-sm text-foreground">{tenant.name}</TableCell>
                      <TableCell>
                        <code className="text-[10px] md:text-xs bg-muted px-2 py-1 rounded text-foreground">
                          {tenant.slug}
                        </code>
                      </TableCell>
                      <TableCell>
                        {(() => {
                          const platform = getTenantPlatform(tenant);
                          const storeUrl = getStoreUrl(tenant);
                          const syncEnabled = getSyncStatus(tenant);
                          const credentialsConfigured = hasCredentials(tenant);

                          if (!platform || !storeUrl) {
                            return (
                              <Badge variant="secondary" className="bg-muted text-muted-foreground border-0 rounded-md px-2 md:px-3 py-1 text-[10px] md:text-xs">
                                <Store className="mr-1 h-3 w-3" />
                                Sin configurar
                              </Badge>
                            );
                          }

                          return (
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-2">
                                {platform === "shopify" ? (
                                  <Badge variant="secondary" className="bg-success-bg text-success border-0 rounded-md px-2 md:px-3 py-1 text-[10px] md:text-xs flex items-center gap-1">
                                    <ShoppingBag className="h-3 w-3" />
                                    <a
                                      href={storeUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="hover:underline"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      Shopify
                                    </a>
                                  </Badge>
                                ) : (
                                  <Badge variant="secondary" className="bg-luma/15 text-marino border-0 rounded-md px-2 md:px-3 py-1 text-[10px] md:text-xs flex items-center gap-1">
                                    <Store className="h-3 w-3" />
                                    <a
                                      href={storeUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="hover:underline"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      WooCommerce
                                    </a>
                                  </Badge>
                                )}
                                <div
                                  className={`h-2 w-2 rounded-full ${syncEnabled ? "bg-success" : "bg-muted-foreground"
                                    }`}
                                  title={syncEnabled ? "Sincronizacion activa" : "Sincronizacion desactivada"}
                                />
                              </div>
                              {!credentialsConfigured && (
                                <span className="text-[9px] md:text-[10px] text-muted-foreground font-medium">
                                  Credenciales pendientes
                                </span>
                              )}
                            </div>
                          );
                        })()}
                      </TableCell>
                      <TableCell>
                        {tenant.is_platform ? (
                          <Badge variant="secondary" className="bg-luma/15 text-marino border-0 hover:bg-luma/15 rounded-md px-2 md:px-3 py-0.5 md:py-1 text-[10px] md:text-xs">
                            Plataforma
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-muted text-foreground border-0 hover:bg-muted rounded-md px-2 md:px-3 py-0.5 md:py-1 text-[10px] md:text-xs">
                            Empresa
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {tenant.is_active ? (
                          <Badge className="bg-success-bg text-success border-success/30">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Activa
                          </Badge>
                        ) : (
                          <Badge className="bg-muted/50 text-foreground border-border">
                            <XCircle className="h-3 w-3 mr-1" />
                            Inactiva
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel className="text-xs md:text-sm">Acciones</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleViewDetails(tenant.id)} className="text-xs md:text-sm">
                              <Eye className="mr-2 h-3 w-3 md:h-4 md:w-4" />
                              Ver detalles
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleEditTenant(tenant)} className="text-xs md:text-sm">
                              <Edit className="mr-2 h-3 w-3 md:h-4 md:w-4" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => handleToggleStatus(tenant)}
                              className={`text-xs md:text-sm ${tenant.is_active ? "text-danger" : "text-success"}`}
                            >
                              <Power className="mr-2 h-3 w-3 md:h-4 md:w-4" />
                              {tenant.is_active ? "Desactivar" : "Activar"}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="text-xs md:text-sm text-muted-foreground">
        Mostrando {filteredTenants.length} de {tenants.length} tenants
      </div>

      {/* Dialogs */}
      <CreateTenantDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSuccess={refreshTenants}
      />

      <EditTenantDialog
        tenant={selectedTenant}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onSuccess={refreshTenants}
      />

      <ToggleTenantStatusDialog
        tenant={selectedTenant}
        open={toggleStatusDialogOpen}
        onOpenChange={setToggleStatusDialogOpen}
        onSuccess={refreshTenants}
      />
    </div>
  );
}


"use client";

import { useEffect, useState } from "react";
import { Building2, Plus, Search, MoreHorizontal, Eye, Edit, Power } from "lucide-react";
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
import { Tenant, TenantFilters } from "@/lib/types/tenant";
import { useRouter } from "next/navigation";
import { CreateTenantDialog } from "@/components/superadmin/create-tenant-dialog";
import { EditTenantDialog } from "@/components/superadmin/edit-tenant-dialog";
import { ToggleTenantStatusDialog } from "@/components/superadmin/toggle-tenant-status-dialog";

export default function TenantsPage() {
  const router = useRouter();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<TenantFilters>({
    search: "",
    status: "all",
    isPlatform: "all",
  });

  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [toggleStatusDialogOpen, setToggleStatusDialogOpen] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);

  useEffect(() => {
    fetchTenants();
  }, []);

  const fetchTenants = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/superadmin/tenants');
      if (response.ok) {
        const data = await response.json();
        console.log('Tenants data:', data.items); // Debug
        setTenants(data.items || []);
      }
    } catch (error) {
      console.error('Error fetching tenants:', error);
    } finally {
      setLoading(false);
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Gestión de Empresas</h1>
          <p className="text-gray-600 mt-2">
            Administra todas las empresas de la plataforma
          </p>
        </div>
        <Button
          className="bg-blue-600 hover:bg-blue-700"
          onClick={() => setCreateDialogOpen(true)}
        >
          <Plus className="mr-2 h-4 w-4" />
          Nueva Empresa
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Buscar por nombre o slug..."
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                className="pl-10"
              />
            </div>
            <Select
              value={filters.status}
              onValueChange={(value) => setFilters({ ...filters, status: value })}
            >
              <SelectTrigger>
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
              <SelectTrigger>
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
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-gray-500">Cargando empresas...</div>
            </div>
          ) : filteredTenants.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Building2 className="h-12 w-12 text-gray-300 mb-4" />
              <p className="text-gray-500">No se encontraron empresas</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Identificador</TableHead>
                  <TableHead>ID de Empresa</TableHead>
                  <TableHead>Tienda Shopify</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTenants.map((tenant) => (
                  <TableRow key={tenant.id}>
                    <TableCell className="font-medium">{tenant.name}</TableCell>
                    <TableCell>
                      <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                        {tenant.slug}
                      </code>
                    </TableCell>
                    <TableCell>
                      {tenant.company_id ? (
                        <span className="text-sm">{tenant.company_id}</span>
                      ) : (
                        <span className="text-gray-400 text-sm">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {tenant.shopify_store_url ? (
                        <a
                          href={tenant.shopify_store_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline text-sm"
                        >
                          {new URL(tenant.shopify_store_url).hostname}
                        </a>
                      ) : (
                        <span className="text-gray-400 text-sm">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {tenant.is_platform ? (
                        <Badge variant="secondary" className="bg-purple-100 text-purple-700">
                          Plataforma
                        </Badge>
                      ) : (
                        <Badge variant="outline">Regular</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {tenant.is_active ? (
                        <Badge className="bg-green-100 text-green-700">Activo</Badge>
                      ) : (
                        <Badge variant="destructive">Inactivo</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleViewDetails(tenant.id)}>
                            <Eye className="mr-2 h-4 w-4" />
                            Ver detalles
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleEditTenant(tenant)}>
                            <Edit className="mr-2 h-4 w-4" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => handleToggleStatus(tenant)}
                            className={tenant.is_active ? "text-red-600" : "text-green-600"}
                          >
                            <Power className="mr-2 h-4 w-4" />
                            {tenant.is_active ? "Desactivar" : "Activar"}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="text-sm text-gray-600">
        Mostrando {filteredTenants.length} de {tenants.length} tenants
      </div>

      {/* Dialogs */}
      <CreateTenantDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSuccess={fetchTenants}
      />

      <EditTenantDialog
        tenant={selectedTenant}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onSuccess={fetchTenants}
      />

      <ToggleTenantStatusDialog
        tenant={selectedTenant}
        open={toggleStatusDialogOpen}
        onOpenChange={setToggleStatusDialogOpen}
        onSuccess={fetchTenants}
      />
    </div>
  );
}

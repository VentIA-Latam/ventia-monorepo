"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useServerTable } from "@/lib/hooks/use-server-table";
import { useRouter } from "next/navigation";
import { Users, Plus, Eye, Power, MoreHorizontal, Edit, CheckCircle, XCircle, Search, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
// getUsers removed — using useServerTable hook with direct fetch
import { useTenant } from "@/lib/context/tenant-context";
import { User } from "@/lib/types/user";
import { Tenant } from "@/lib/types/tenant";
import { CreateUserDialog } from "@/components/superadmin/create-user-dialog";
import { EditUserDialog } from "@/components/superadmin/edit-user-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ToggleUserStatusDialog } from "@/components/superadmin/toggle-user-status-dialog";

export function UsersClient({ initialUsers, initialTotal, tenants }: { initialUsers: User[], initialTotal: number, tenants: Tenant[] }) {
  const ITEMS_PER_PAGE = 10;
  const router = useRouter();
  const { selectedTenantId } = useTenant();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);

  const fetchUsersFromApi = useCallback(async (params: Record<string, string>, signal: AbortSignal) => {
    const res = await fetch(`/api/superadmin/users?${new URLSearchParams(params)}`, { signal });
    if (!res.ok) throw new Error("Failed to fetch users");
    return res.json();
  }, []);

  const { items: filteredUsers, total, loading, isStale, fetchData, debouncedFetch } = useServerTable<User>({
    initialItems: initialUsers,
    initialTotal,
    fetchFn: fetchUsersFromApi,
  });

  const totalPages = Math.ceil(total / ITEMS_PER_PAGE);

  const buildParams = useCallback(
    (overrides: Record<string, string> = {}) => {
      const p: Record<string, string> = {
        skip: overrides.skip ?? String((currentPage - 1) * ITEMS_PER_PAGE),
        limit: overrides.limit ?? String(ITEMS_PER_PAGE),
      };
      if (selectedTenantId) p.tenant_id = String(selectedTenantId);
      const s = overrides.search ?? search;
      const r = overrides.role ?? (roleFilter !== "all" ? roleFilter : "");
      const st = overrides.is_active ?? (statusFilter === "active" ? "true" : statusFilter === "inactive" ? "false" : "");
      if (s) p.search = s;
      if (r) p.role = r;
      if (st) p.is_active = st;
      return p;
    },
    [currentPage, search, roleFilter, statusFilter, selectedTenantId]
  );

  const handleSearch = (value: string) => {
    setSearch(value);
    setCurrentPage(1);
    debouncedFetch(buildParams({ search: value, skip: "0" }));
  };

  const handleRoleFilter = (value: string) => {
    setRoleFilter(value);
    setCurrentPage(1);
    fetchData(buildParams({ role: value !== "all" ? value : "", skip: "0" }));
  };

  const handleStatusFilter = (value: string) => {
    setStatusFilter(value);
    setCurrentPage(1);
    const isActive = value === "active" ? "true" : value === "inactive" ? "false" : "";
    fetchData(buildParams({ is_active: isActive, skip: "0" }));
  };

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    fetchData(buildParams({ skip: String((newPage - 1) * ITEMS_PER_PAGE) }));
  };

  const prevTenantId = useRef(selectedTenantId);
  useEffect(() => {
    if (prevTenantId.current === selectedTenantId) return;
    prevTenantId.current = selectedTenantId;
    setCurrentPage(1);
    fetchData({ skip: "0", limit: String(ITEMS_PER_PAGE), ...(selectedTenantId ? { tenant_id: String(selectedTenantId) } : {}) });
  }, [selectedTenantId]);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [toggleStatusDialogOpen, setToggleStatusDialogOpen] = useState(false);

  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userForStatus, setUserForStatus] = useState<User | null>(null);

  const refreshUsers = () => fetchData(buildParams());

  const handleEditUser = (user: User) => {
    setSelectedUser(user);
    setEditDialogOpen(true);
  };

  const handleToggleStatus = (user: User) => {
    setUserForStatus(user);
    setToggleStatusDialogOpen(true);
  };

  const handleShowDetail = (user: User) => {
    router.push(`/superadmin/users/${user.id}`);
  };

  const getTenantName = (tenantId: number | null) => {
    if (!tenantId) return "—";
    const tenant = tenants.find(t => t.id === tenantId);
    return tenant ? tenant.name : "Desconocido";
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar por nombre o email..." value={search} onChange={(e) => handleSearch(e.target.value)} className="pl-10" />
        </div>
        <Select value={roleFilter} onValueChange={handleRoleFilter}>
          <SelectTrigger className="w-full sm:w-[160px]"><SelectValue placeholder="Rol" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los roles</SelectItem>
            <SelectItem value="ADMIN">Admin</SelectItem>
            <SelectItem value="LOGISTICA">Logística</SelectItem>
            <SelectItem value="VENTAS">Ventas</SelectItem>
            <SelectItem value="VIEWER">Viewer</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={handleStatusFilter}>
          <SelectTrigger className="w-full sm:w-[160px]"><SelectValue placeholder="Estado" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="active">Activos</SelectItem>
            <SelectItem value="inactive">Inactivos</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nuevo Usuario
        </Button>
      </div>

      {/* Results count */}
      <p className="text-sm text-muted-foreground">
        Mostrando <span className="font-semibold">{filteredUsers.length}</span> usuarios
      </p>

      {/* Table */}
      <div className={isStale ? "opacity-50 pointer-events-none transition-opacity" : "transition-opacity"}>
      {loading && !isStale ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Cargando usuarios...</span>
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12">
          <Users className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">No se encontraron usuarios</p>
        </div>
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Rol</TableHead>
                {!selectedTenantId ? <TableHead>Empresa</TableHead> : null}
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.name}</TableCell>
                  <TableCell className="text-muted-foreground">{user.email}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="bg-volt/10 text-volt border-0 rounded-md">
                      {user.role}
                    </Badge>
                  </TableCell>
                  {!selectedTenantId ? <TableCell>{getTenantName(user.tenant_id)}</TableCell> : null}
                  <TableCell>
                    {user.is_active ? (
                      <Badge className="bg-success-bg text-success border-success/30">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Activo
                      </Badge>
                    ) : (
                      <Badge className="bg-muted/50 text-foreground border-border">
                        <XCircle className="h-3 w-3 mr-1" />
                        Inactivo
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleShowDetail(user)}>
                          <Eye className="mr-2 h-4 w-4" />
                          Ver detalles
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleEditUser(user)}>
                          <Edit className="mr-2 h-4 w-4" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleToggleStatus(user)} className={user.is_active ? "text-danger" : "text-success"}>
                          <Power className="mr-2 h-4 w-4" />
                          {user.is_active ? "Desactivar" : "Activar"}
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

      </div>

      {/* Pagination */}
      {totalPages > 1 ? (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Página {currentPage} de {totalPages}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={currentPage === 1} onClick={() => handlePageChange(Math.max(1, currentPage - 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" disabled={currentPage === totalPages} onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : null}

      <CreateUserDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSuccess={refreshUsers}
        tenants={tenants}
      />
      <EditUserDialog
        user={selectedUser}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onSuccess={refreshUsers}
        tenants={tenants}
      />
      <ToggleUserStatusDialog
        user={userForStatus}
        open={toggleStatusDialogOpen}
        onOpenChange={setToggleStatusDialogOpen}
        onSuccess={refreshUsers}
      />
    </div>
  );
}

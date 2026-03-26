"use client";
import { useState, useMemo, useEffect, useRef } from "react";
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
import { getUsers } from "@/lib/api-client";
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
  const router = useRouter();
  const { selectedTenantId } = useTenant();
  const [users, setUsers] = useState<User[]>(initialUsers);
  const [total, setTotal] = useState(initialTotal);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const isInitialMount = useRef(true);

  // Server-side pagination + tenant filter
  useEffect(() => {
    if (isInitialMount.current) { isInitialMount.current = false; return () => { isInitialMount.current = true; }; }
    let cancelled = false;
    setLoading(true);
    const skip = (currentPage - 1) * itemsPerPage;
    const params: { skip: number; limit: number; tenant_id?: number } = { skip, limit: itemsPerPage };
    if (selectedTenantId) params.tenant_id = selectedTenantId;
    getUsers(params)
      .then((data) => { if (!cancelled) { setUsers(data.items || []); setTotal(data.total ?? 0); } })
      .catch((err) => console.error("Error fetching users:", err))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [currentPage, selectedTenantId]);

  // Reset page on tenant change
  useEffect(() => { setCurrentPage(1); }, [selectedTenantId]);

  // Client-side filtering for search/role/status
  const filteredUsers = useMemo(() => users.filter((u) => {
    if (search) {
      const s = search.toLowerCase();
      if (!u.name?.toLowerCase().includes(s) && !u.email?.toLowerCase().includes(s)) return false;
    }
    if (roleFilter !== "all" && u.role !== roleFilter) return false;
    if (statusFilter === "active" && !u.is_active) return false;
    if (statusFilter === "inactive" && u.is_active) return false;
    return true;
  }), [users, search, roleFilter, statusFilter]);

  const totalPages = Math.ceil(total / itemsPerPage);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [toggleStatusDialogOpen, setToggleStatusDialogOpen] = useState(false);

  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userForStatus, setUserForStatus] = useState<User | null>(null);

  const refreshUsers = async () => {
    try {
      const skip = (currentPage - 1) * itemsPerPage;
      const params: { skip: number; limit: number; tenant_id?: number } = { skip, limit: itemsPerPage };
      if (selectedTenantId) params.tenant_id = selectedTenantId;
      const data = await getUsers(params);
      setUsers(data.items || []);
      setTotal(data.total ?? 0);
    } catch {
      // handle error
    }
  };

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
          <Input placeholder="Buscar por nombre o email..." value={search} onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }} className="pl-10" />
        </div>
        <Select value={roleFilter} onValueChange={(v) => { setRoleFilter(v); setCurrentPage(1); }}>
          <SelectTrigger className="w-full sm:w-[160px]"><SelectValue placeholder="Rol" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los roles</SelectItem>
            <SelectItem value="ADMIN">Admin</SelectItem>
            <SelectItem value="LOGISTICA">Logística</SelectItem>
            <SelectItem value="VENTAS">Ventas</SelectItem>
            <SelectItem value="VIEWER">Viewer</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setCurrentPage(1); }}>
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
      {loading ? (
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

      {/* Pagination */}
      {totalPages > 1 ? (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Página {currentPage} de {totalPages}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={currentPage === 1} onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" disabled={currentPage === totalPages} onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}>
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

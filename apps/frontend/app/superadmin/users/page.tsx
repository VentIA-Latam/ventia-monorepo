"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Users, Plus, Eye, Power, MoreHorizontal, Edit } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { UserDetailDialog } from "@/components/superadmin/user-detail-dialog";

export default function UsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [toggleStatusDialogOpen, setToggleStatusDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);

  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userForStatus, setUserForStatus] = useState<User | null>(null);
  const [userForDetail, setUserForDetail] = useState<User | null>(null);

  useEffect(() => {
    fetchUsers();
    fetchTenants();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/superadmin/users");
      if (response.ok) {
        const data = await response.json();
        setUsers(data.items || []);
      }
    } catch {
      // handle error
    } finally {
      setLoading(false);
    }
  };

  const fetchTenants = async () => {
    try {
      const response = await fetch("/api/superadmin/tenants");
      if (response.ok) {
        const data = await response.json();
        setTenants(data.items || []);
      }
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
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Gestión de Usuarios</h1>
          <p className="text-sm md:text-base text-gray-600 mt-1 md:mt-2">
            Administra todos los usuarios del sistema
          </p>
        </div>
        <Button
          className="bg-green-600 hover:bg-green-700 w-full sm:w-auto text-sm md:text-base"
          onClick={() => setCreateDialogOpen(true)}
        >
          <Plus className="mr-2 h-4 w-4" />
          Nuevo Usuario
        </Button>
      </div>
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-sm md:text-base text-gray-500">Cargando usuarios...</div>
            </div>
          ) : users.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Users className="h-10 w-10 md:h-12 md:w-12 text-gray-300 mb-3 md:mb-4" />
              <p className="text-sm md:text-base text-gray-500">No se encontraron usuarios</p>
            </div>
          ) : (
            <div className="border rounded-lg bg-white shadow-sm overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50/80 border-b border-gray-200">
                    <TableHead className="text-xs md:text-sm min-w-[150px]">NOMBRE</TableHead>
                    <TableHead className="text-xs md:text-sm min-w-[180px]">EMAIL</TableHead>
                    <TableHead className="text-xs md:text-sm min-w-[100px]">ROL</TableHead>
                    <TableHead className="text-xs md:text-sm min-w-[100px]">ESTADO</TableHead>
                    <TableHead className="text-xs md:text-sm min-w-[100px]">ACCIONES</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id} className="hover:bg-gray-50/50 cursor-pointer transition-colors border-b border-gray-100 last:border-0">
                      <TableCell className="font-medium text-xs md:text-sm text-gray-900">{user.name}</TableCell>
                      <TableCell className="text-xs md:text-sm text-gray-600">{user.email}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="bg-blue-100 text-blue-700 border-0 hover:bg-blue-100 rounded-md px-2 md:px-3 py-0.5 md:py-1 text-[10px] md:text-xs">
                          {user.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {user.is_active ? (
                          <Badge variant="secondary" className="bg-green-100 text-green-700 border-0 hover:bg-green-100 rounded-md px-2 md:px-3 py-0.5 md:py-1 text-[10px] md:text-xs">
                            Activo
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-red-100 text-red-700 border-0 hover:bg-red-100 rounded-md px-2 md:px-3 py-0.5 md:py-1 text-[10px] md:text-xs">
                            Inactivo
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
                            <DropdownMenuItem onClick={() => handleShowDetail(user)} className="text-xs md:text-sm">
                              <Eye className="mr-2 h-3 w-3 md:h-4 md:w-4" />
                              Ver detalles
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleEditUser(user)} className="text-xs md:text-sm">
                              <Edit className="mr-2 h-3 w-3 md:h-4 md:w-4" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => handleToggleStatus(user)}
                              className={`text-xs md:text-sm ${user.is_active ? "text-red-600" : "text-green-600"}`}
                            >
                              <Power className="mr-2 h-3 w-3 md:h-4 md:w-4" />
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
        </CardContent>
      </Card>
      <CreateUserDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSuccess={fetchUsers}
        tenants={tenants}
      />
      <EditUserDialog
        user={selectedUser}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onSuccess={fetchUsers}
        tenants={tenants}
      />
      <ToggleUserStatusDialog
        user={userForStatus}
        open={toggleStatusDialogOpen}
        onOpenChange={setToggleStatusDialogOpen}
        onSuccess={fetchUsers}
      />
      {/* <UserDetailDialog user={userForDetail} open={detailDialogOpen} onOpenChange={setDetailDialogOpen} /> */}
    </div>
  );
}

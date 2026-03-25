"use client";

import { useEffect, useState } from "react";
import { Key, Plus, Search, MoreHorizontal, Trash2, CheckCircle, XCircle, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
// Card imports removed — using flat layout pattern
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
import { APIKey } from "@/lib/types/api-key";
import { Tenant } from "@/lib/types/tenant";
import { CreateAPIKeyDialog } from "@/components/superadmin/create-api-key-dialog";
import { RevokeAPIKeyDialog } from "@/components/superadmin/revoke-api-key-dialog";
// Alert imports removed — no info alerts in standard pattern
import { formatDateTime } from "@/lib/utils";
import { useTenant } from "@/lib/context/tenant-context";

export default function SuperAdminAPIKeysPage() {
  const { selectedTenantId, tenants } = useTenant();
  const [apiKeys, setApiKeys] = useState<APIKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [revokeDialogOpen, setRevokeDialogOpen] = useState(false);
  const [selectedApiKey, setSelectedApiKey] = useState<APIKey | null>(null);

  useEffect(() => {
    fetchAPIKeys();
  }, [statusFilter, selectedTenantId]);

  const fetchAPIKeys = async () => {
    try {
      setLoading(true);
      let url = `/api/superadmin/api-keys?limit=100`;

      if (statusFilter !== "all") {
        url += `&is_active=${statusFilter === "active"}`;
      }
      if (selectedTenantId) {
        url += `&tenant_id=${selectedTenantId}`;
      }

      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setApiKeys(data.items || []);
      }
    } catch (error) {
      console.error("Error fetching API keys:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleRevoke = (apiKey: APIKey) => {
    setSelectedApiKey(apiKey);
    setRevokeDialogOpen(true);
  };

  const filteredAPIKeys = apiKeys.filter((key) =>
    key.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    key.key_prefix.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'ADMIN':
        return 'bg-luma/15 text-marino';
      case 'LOGISTICA':
        return 'bg-volt/10 text-volt';
      case 'VENTAS':
        return 'bg-success-bg text-success';
      case 'VIEWER':
        return 'bg-muted text-foreground';
      default:
        return 'bg-muted text-foreground';
    }
  };

  const getTenantName = (tenantId: number): string => {
    const tenant = tenants.find((t) => t.id === tenantId);
    return tenant ? tenant.name : `Tenant #${tenantId}`;
  };

  const getLastUsedBadge = (lastUsedAt: string | null) => {
    if (!lastUsedAt) {
      return <Badge variant="secondary" className="text-xs bg-muted text-foreground border-0 rounded-md px-2 py-0.5">Sin usar</Badge>;
    }

    const lastUsed = new Date(lastUsedAt);
    const now = new Date();
    const diffHours = Math.floor((now.getTime() - lastUsed.getTime()) / (1000 * 60 * 60));

    if (diffHours < 24) {
      return <Badge variant="secondary" className="bg-success-bg text-success border-0 rounded-md px-2 py-0.5 text-xs">Reciente</Badge>;
    } else if (diffHours < 168) { // 7 days
      return <Badge variant="secondary" className="text-xs bg-volt/10 text-volt border-0 rounded-md px-2 py-0.5">{Math.floor(diffHours / 24)}d atrás</Badge>;
    } else {
      return <Badge variant="secondary" className="text-xs bg-muted text-muted-foreground border-0 rounded-md px-2 py-0.5">Hace más de 1 semana</Badge>;
    }
  };

  const itemsPerPage = 10;
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.ceil(filteredAPIKeys.length / itemsPerPage);
  const currentKeys = filteredAPIKeys.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input placeholder="Buscar por nombre o prefijo..." value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }} className="pl-10" />
        </div>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setCurrentPage(1); }}>
          <SelectTrigger className="w-full sm:w-[160px]"><SelectValue placeholder="Estado" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            <SelectItem value="active">Activos</SelectItem>
            <SelectItem value="inactive">Inactivos</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Crear API Key
        </Button>
      </div>

      {/* Results count */}
      <p className="text-sm text-muted-foreground">
        Mostrando <span className="font-semibold">{filteredAPIKeys.length}</span> API keys
        {selectedTenantId && tenants.find(t => t.id === selectedTenantId) ? (
          <> de <span className="font-semibold">{tenants.find(t => t.id === selectedTenantId)?.name}</span></>
        ) : null}
      </p>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Cargando API Keys...</span>
        </div>
      ) : currentKeys.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12">
          <Key className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">No se encontraron API Keys</p>
        </div>
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Prefijo</TableHead>
                <TableHead>Rol</TableHead>
                {!selectedTenantId ? <TableHead>Empresa</TableHead> : null}
                <TableHead>Ultimo uso</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Expira</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {currentKeys.map((apiKey) => (
                    <TableRow key={apiKey.id} className="hover:bg-cielo/30 transition-colors border-b border-border last:border-0">
                      <TableCell className="font-medium text-xs md:text-sm text-foreground">{apiKey.name}</TableCell>
                      <TableCell>
                        <code className="text-[10px] md:text-sm bg-muted px-2 py-1 rounded text-foreground">
                          {apiKey.key_prefix}••••••••
                        </code>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={`${getRoleBadgeColor(apiKey.role)} border-0 rounded-md px-2 md:px-3 py-0.5 md:py-1 text-[10px] md:text-xs`}>
                          {apiKey.role}
                        </Badge>
                      </TableCell>
                      {!selectedTenantId ? <TableCell className="text-sm text-foreground font-medium">{getTenantName(apiKey.tenant_id)}</TableCell> : null}
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          {getLastUsedBadge(apiKey.last_used_at)}
                          {apiKey.last_used_at && (
                            <span className="text-[10px] md:text-xs text-muted-foreground">
                              {apiKey.last_used_at ? formatDateTime(apiKey.last_used_at) : "Nunca"}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {apiKey.is_active ? (
                          <Badge className="bg-success-bg text-success border-success/30">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Activa
                          </Badge>
                        ) : (
                          <Badge className="bg-muted/50 text-foreground border-border">
                            <XCircle className="h-3 w-3 mr-1" />
                            Revocada
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs md:text-sm text-muted-foreground">
                        {apiKey.expires_at ? formatDateTime(apiKey.expires_at) : "Sin vencimiento"}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel className="text-xs md:text-sm">Acciones</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            {apiKey.is_active && (
                              <DropdownMenuItem
                                className="text-danger text-xs md:text-sm"
                                onClick={() => handleRevoke(apiKey)}
                              >
                                <Trash2 className="mr-2 h-3 w-3 md:h-4 md:w-4" />
                                Revocar
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}

      {/* Pagination */}
      {totalPages > 1 ? (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Página {currentPage} de {totalPages}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={currentPage === 1} onClick={() => setCurrentPage((p) => p - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" disabled={currentPage === totalPages} onClick={() => setCurrentPage((p) => p + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : null}

      {/* Dialogs */}
      <CreateAPIKeyDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSuccess={fetchAPIKeys}
        apiEndpoint="/api/superadmin/api-keys"
        tenants={tenants}
      />

      <RevokeAPIKeyDialog
        apiKey={selectedApiKey}
        open={revokeDialogOpen}
        onOpenChange={setRevokeDialogOpen}
        onSuccess={fetchAPIKeys}
        apiEndpoint="/api/superadmin/api-keys"
      />
    </div>
  );
}


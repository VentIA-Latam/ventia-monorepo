"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useServerTable } from "@/lib/hooks/use-server-table";
import { Key, Plus, Search, MoreHorizontal, Trash2, CheckCircle, XCircle, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { APIKey } from "@/lib/types/api-key";
import { CreateAPIKeyDialog } from "@/components/superadmin/create-api-key-dialog";
import { RevokeAPIKeyDialog } from "@/components/superadmin/revoke-api-key-dialog";
import { formatDateTime } from "@/lib/utils";
import { useTenant } from "@/lib/context/tenant-context";

interface ApiKeysClientProps {
  initialApiKeys: APIKey[];
  initialTotal: number;
}

export function ApiKeysClient({ initialApiKeys, initialTotal }: ApiKeysClientProps) {
  const ITEMS_PER_PAGE = 10;
  const { selectedTenantId, tenants } = useTenant();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);

  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [revokeDialogOpen, setRevokeDialogOpen] = useState(false);
  const [selectedApiKey, setSelectedApiKey] = useState<APIKey | null>(null);

  const fetchApiKeysFromApi = useCallback(async (params: Record<string, string>, signal: AbortSignal) => {
    const res = await fetch(`/api/api-keys?${new URLSearchParams(params)}`, { signal });
    if (!res.ok) throw new Error("Failed to fetch API keys");
    return res.json();
  }, []);

  const { items: filteredKeys, total, loading, isStale, fetchData, debouncedFetch } = useServerTable<APIKey>({
    initialItems: initialApiKeys,
    initialTotal,
    fetchFn: fetchApiKeysFromApi,
  });

  const totalPages = Math.ceil(total / ITEMS_PER_PAGE);

  const buildParams = useCallback(
    (overrides: Record<string, string> = {}) => {
      const p: Record<string, string> = {
        skip: overrides.skip ?? String((currentPage - 1) * ITEMS_PER_PAGE),
        limit: overrides.limit ?? String(ITEMS_PER_PAGE),
      };
      if (selectedTenantId) p.tenant_id = String(selectedTenantId);
      const s = overrides.search ?? searchTerm;
      const st = overrides.is_active ?? (statusFilter === "active" ? "true" : statusFilter === "inactive" ? "false" : "");
      if (s) p.search = s;
      if (st) p.is_active = st;
      return p;
    },
    [currentPage, searchTerm, statusFilter, selectedTenantId]
  );

  const handleSearch = (value: string) => {
    setSearchTerm(value);
    setCurrentPage(1);
    debouncedFetch(buildParams({ search: value, skip: "0" }));
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

  // Tenant change — reset to page 1
  const prevTenantId = useRef(selectedTenantId);
  useEffect(() => {
    if (prevTenantId.current === selectedTenantId) return;
    prevTenantId.current = selectedTenantId;
    setCurrentPage(1);
    fetchData({ skip: "0", limit: String(ITEMS_PER_PAGE), ...(selectedTenantId ? { tenant_id: String(selectedTenantId) } : {}) });
  }, [selectedTenantId]);

  const refreshApiKeys = () => fetchData(buildParams());

  const handleRevoke = (apiKey: APIKey) => {
    setSelectedApiKey(apiKey);
    setRevokeDialogOpen(true);
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'ADMIN': return 'bg-luma/15 text-marino';
      case 'LOGISTICA': return 'bg-volt/10 text-volt';
      case 'VENTAS': return 'bg-success-bg text-success';
      default: return 'bg-muted text-foreground';
    }
  };

  const getTenantName = (tenantId: number): string => {
    const tenant = tenants.find((t) => t.id === tenantId);
    return tenant ? tenant.name : `Tenant #${tenantId}`;
  };

  const getLastUsedBadge = (lastUsedAt: string | null) => {
    if (!lastUsedAt) return <Badge variant="secondary" className="text-xs bg-muted text-foreground border-0 rounded-md px-2 py-0.5">Sin usar</Badge>;
    const diffHours = Math.floor((Date.now() - new Date(lastUsedAt).getTime()) / 3600000);
    if (diffHours < 24) return <Badge variant="secondary" className="bg-success-bg text-success border-0 rounded-md px-2 py-0.5 text-xs">Reciente</Badge>;
    if (diffHours < 168) return <Badge variant="secondary" className="text-xs bg-volt/10 text-volt border-0 rounded-md px-2 py-0.5">{Math.floor(diffHours / 24)}d atras</Badge>;
    return <Badge variant="secondary" className="text-xs bg-muted text-muted-foreground border-0 rounded-md px-2 py-0.5">+1 semana</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input placeholder="Buscar por nombre o prefijo..." value={searchTerm} onChange={(e) => handleSearch(e.target.value)} className="pl-10" />
        </div>
        <Select value={statusFilter} onValueChange={handleStatusFilter}>
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
        Mostrando <span className="font-semibold">{filteredKeys.length}</span> API keys
        {selectedTenantId !== null ? (
          <> de <span className="font-semibold">{getTenantName(selectedTenantId)}</span></>
        ) : null}
      </p>

      {/* Table */}
      <div className={isStale ? "opacity-50 pointer-events-none transition-opacity" : "transition-opacity"}>
      {loading && !isStale ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Cargando API Keys...</span>
        </div>
      ) : filteredKeys.length === 0 ? (
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
                {selectedTenantId === null ? <TableHead>Empresa</TableHead> : null}
                <TableHead>Ultimo uso</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Expira</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredKeys.map((apiKey) => (
                <TableRow key={apiKey.id}>
                  <TableCell className="font-medium">{apiKey.name}</TableCell>
                  <TableCell>
                    <code className="text-sm bg-muted px-2 py-1 rounded">{apiKey.key_prefix}••••••••</code>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={`${getRoleBadgeColor(apiKey.role)} border-0 rounded-md`}>{apiKey.role}</Badge>
                  </TableCell>
                  {selectedTenantId === null ? <TableCell>{getTenantName(apiKey.tenant_id)}</TableCell> : null}
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      {getLastUsedBadge(apiKey.last_used_at)}
                      {apiKey.last_used_at ? (
                        <span className="text-xs text-muted-foreground">{formatDateTime(apiKey.last_used_at)}</span>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell>
                    {apiKey.is_active ? (
                      <Badge className="bg-success-bg text-success border-success/30"><CheckCircle className="h-3 w-3 mr-1" />Activa</Badge>
                    ) : (
                      <Badge className="bg-muted/50 text-foreground border-border"><XCircle className="h-3 w-3 mr-1" />Revocada</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {apiKey.expires_at ? formatDateTime(apiKey.expires_at) : "Sin vencimiento"}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {apiKey.is_active ? (
                          <DropdownMenuItem className="text-danger" onClick={() => handleRevoke(apiKey)}>
                            <Trash2 className="mr-2 h-4 w-4" />Revocar
                          </DropdownMenuItem>
                        ) : null}
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
          <p className="text-sm text-muted-foreground">Página {currentPage} de {totalPages} ({total} resultados)</p>
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

      {/* Dialogs */}
      <CreateAPIKeyDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSuccess={refreshApiKeys}
        apiEndpoint="/api/api-keys"
        tenants={tenants}
      />
      <RevokeAPIKeyDialog
        apiKey={selectedApiKey}
        open={revokeDialogOpen}
        onOpenChange={setRevokeDialogOpen}
        onSuccess={refreshApiKeys}
        apiEndpoint="/api/api-keys"
      />
    </div>
  );
}

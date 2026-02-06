"use client";

import { useEffect, useState } from "react";
import { Key, Plus, Search, MoreHorizontal, Trash2, CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info } from "lucide-react";
import { formatDateTime } from "@/lib/utils";

export default function SuperAdminAPIKeysPage() {
  const [apiKeys, setApiKeys] = useState<APIKey[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [tenantFilter, setTenantFilter] = useState<string>("all");

  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [revokeDialogOpen, setRevokeDialogOpen] = useState(false);
  const [selectedApiKey, setSelectedApiKey] = useState<APIKey | null>(null);

  useEffect(() => {
    fetchAPIKeys();
    fetchTenants();
  }, []);

  useEffect(() => {
    fetchAPIKeys();
  }, [statusFilter, tenantFilter]);

  const fetchAPIKeys = async () => {
    try {
      setLoading(true);
      let url = `/api/superadmin/api-keys?limit=100`;

      if (statusFilter !== "all") {
        url += `&is_active=${statusFilter === "active"}`;
      }
      if (tenantFilter !== "all") {
        url += `&tenant_id=${tenantFilter}`;
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

  const fetchTenants = async () => {
    console.log('fetchTenants called');
    try {
      const response = await fetch("/api/superadmin/tenants?limit=100");
      console.log('Tenants response:', response);
      if (response.ok) {
        const data = await response.json();
        console.log('Tenants fetched:', data);
        console.log('Tenants items:', data.items);
        setTenants(data.items || []);
      } else {
        console.error('Failed to fetch tenants:', response.status);
      }
    } catch (error) {
      console.error("Error fetching tenants:", error);
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

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground font-heading flex items-center gap-2">
            <Key className="h-6 w-6 md:h-8 md:w-8" />
            API Keys
          </h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">
            Gestiona las claves de API para integraciones externas (n8n, webhooks, etc.)
          </p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)} className="w-full sm:w-auto text-sm md:text-base">
          <Plus className="mr-2 h-4 w-4" />
          Crear API Key
        </Button>
      </div>

      <Alert className="bg-volt/10 border-volt/30">
        <Info className="h-4 w-4 text-volt shrink-0" />
        <AlertDescription className="text-xs md:text-sm text-volt">
          <b>Documentación para n8n:</b> Las API Keys permiten autenticación en workflows.
          Usa el header <code className="bg-volt/10 px-1 rounded text-[10px] md:text-xs">X-API-Key: tu_clave</code> en tus requests HTTP.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base md:text-lg">Lista de API Keys</CardTitle>
              <CardDescription className="text-xs md:text-sm">
                {filteredAPIKeys.length} clave{filteredAPIKeys.length !== 1 ? 's' : ''} encontrada{filteredAPIKeys.length !== 1 ? 's' : ''}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3 md:gap-4 items-stretch sm:items-center">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Buscar por nombre o prefijo..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 text-sm md:text-base"
              />
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-45 text-sm md:text-base">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                <SelectItem value="active">Activos</SelectItem>
                <SelectItem value="inactive">Inactivos</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          <div className="border rounded-lg bg-card shadow-sm overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 border-b border-border">
                  <TableHead>NOMBRE</TableHead>
                  <TableHead>PREFIJO</TableHead>
                  <TableHead>ROL</TableHead>
                  <TableHead>TENANT</TableHead>
                  <TableHead>ÚLTIMO USO</TableHead>
                  <TableHead>ESTADO</TableHead>
                  <TableHead>EXPIRA</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-xs md:text-sm text-muted-foreground">
                      Cargando API Keys...
                    </TableCell>
                  </TableRow>
                ) : filteredAPIKeys.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-xs md:text-sm text-muted-foreground">
                      No se encontraron API Keys
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAPIKeys.map((apiKey) => (
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
                      <TableCell className="text-xs md:text-sm text-foreground font-medium">{getTenantName(apiKey.tenant_id)}</TableCell>
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
        </CardContent>
      </Card>

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

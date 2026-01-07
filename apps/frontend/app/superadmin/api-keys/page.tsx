"use client";

import { useEffect, useState } from "react";
import { Key, Plus, Search, MoreHorizontal, Trash2 } from "lucide-react";
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
import { CreateAPIKeyDialog } from "@/components/superadmin/create-api-key-dialog";
import { RevokeAPIKeyDialog } from "@/components/superadmin/revoke-api-key-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info } from "lucide-react";

export default function SuperAdminAPIKeysPage() {
  const [apiKeys, setApiKeys] = useState<APIKey[]>([]);
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
        return 'bg-purple-100 text-purple-700';
      case 'LOGISTICA':
        return 'bg-blue-100 text-blue-700';
      case 'VENTAS':
        return 'bg-green-100 text-green-700';
      case 'VIEWER':
        return 'bg-gray-100 text-gray-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Nunca";
    return new Date(dateString).toLocaleString('es-ES', {
      dateStyle: 'short',
      timeStyle: 'short'
    });
  };

  const getLastUsedBadge = (lastUsedAt: string | null) => {
    if (!lastUsedAt) {
      return <Badge variant="secondary" className="text-xs bg-gray-100 text-gray-700 border-0 rounded-md px-2 py-0.5">Sin usar</Badge>;
    }

    const lastUsed = new Date(lastUsedAt);
    const now = new Date();
    const diffHours = Math.floor((now.getTime() - lastUsed.getTime()) / (1000 * 60 * 60));

    if (diffHours < 24) {
      return <Badge variant="secondary" className="bg-green-100 text-green-700 border-0 rounded-md px-2 py-0.5 text-xs">Reciente</Badge>;
    } else if (diffHours < 168) { // 7 days
      return <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700 border-0 rounded-md px-2 py-0.5">{Math.floor(diffHours / 24)}d atrás</Badge>;
    } else {
      return <Badge variant="secondary" className="text-xs bg-gray-100 text-gray-600 border-0 rounded-md px-2 py-0.5">Hace más de 1 semana</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <Key className="h-8 w-8" />
            API Keys
          </h1>
          <p className="text-gray-600 mt-1">
            Gestiona las claves de API para integraciones externas (n8n, webhooks, etc.)
          </p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Crear API Key
        </Button>
      </div>

      <Alert className="bg-blue-50 border-blue-200">
        <Info className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-blue-800">
          <b>Documentación para n8n:</b> Las API Keys permiten autenticación en workflows.
          Usa el header <code className="bg-blue-100 px-1 rounded">X-API-Key: tu_clave</code> en tus requests HTTP.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Lista de API Keys</CardTitle>
              <CardDescription>
                {filteredAPIKeys.length} clave{filteredAPIKeys.length !== 1 ? 's' : ''} encontrada{filteredAPIKeys.length !== 1 ? 's' : ''}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex gap-4 items-center">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Buscar por nombre o prefijo..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-45">
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
          <div className="border rounded-lg bg-white shadow-sm overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50/80 border-b border-gray-200">
                  <TableHead>NOMBRE</TableHead>
                  <TableHead>PREFIJO</TableHead>
                  <TableHead>ROL</TableHead>
                  <TableHead>TENANT ID</TableHead>
                  <TableHead>ÚLTIMO USO</TableHead>
                  <TableHead>ESTADO</TableHead>
                  <TableHead>EXPIRA</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                      Cargando API Keys...
                    </TableCell>
                  </TableRow>
                ) : filteredAPIKeys.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                      No se encontraron API Keys
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAPIKeys.map((apiKey) => (
                    <TableRow key={apiKey.id} className="hover:bg-gray-50/50 transition-colors border-b border-gray-100 last:border-0">
                      <TableCell className="font-medium text-sm text-gray-900">{apiKey.name}</TableCell>
                      <TableCell>
                        <code className="text-sm bg-gray-100 px-2 py-1 rounded text-gray-700">
                          {apiKey.key_prefix}••••••••
                        </code>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={`${getRoleBadgeColor(apiKey.role)} border-0 rounded-md px-3 py-1`}>
                          {apiKey.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">{apiKey.tenant_id}</TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          {getLastUsedBadge(apiKey.last_used_at)}
                          {apiKey.last_used_at && (
                            <span className="text-xs text-gray-500">
                              {formatDate(apiKey.last_used_at)}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {apiKey.is_active ? (
                          <Badge variant="secondary" className="bg-green-100 text-green-700 border-0 hover:bg-green-100 rounded-md px-3 py-1">
                            Activa
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-red-100 text-red-700 border-0 hover:bg-red-100 rounded-md px-3 py-1">
                            Revocada
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">
                        {apiKey.expires_at ? formatDate(apiKey.expires_at) : "Sin vencimiento"}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            {apiKey.is_active && (
                              <DropdownMenuItem
                                className="text-red-600"
                                onClick={() => handleRevoke(apiKey)}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
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

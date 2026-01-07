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
import { CreateAPIKeyDialog } from "@/components/dashboard/create-api-key-dialog";
import { RevokeAPIKeyDialog } from "@/components/superadmin/revoke-api-key-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info, BookOpen } from "lucide-react";

export default function TenantAPIKeysPage() {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const fetchAPIKeys = async () => {
    try {
      setLoading(true);
      let url = `/api/dashboard/api-keys?limit=100`;

      if (statusFilter !== "all") {
        url += `&is_active=${statusFilter === "active"}`;
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
      return <Badge variant="secondary" className="text-xs">Sin usar</Badge>;
    }

    const lastUsed = new Date(lastUsedAt);
    const now = new Date();
    const diffHours = Math.floor((now.getTime() - lastUsed.getTime()) / (1000 * 60 * 60));

    if (diffHours < 24) {
      return <Badge className="bg-green-100 text-green-700 text-xs">Reciente</Badge>;
    } else if (diffHours < 168) { // 7 days
      return <Badge variant="secondary" className="text-xs">{Math.floor(diffHours / 24)}d atrás</Badge>;
    } else {
      return <Badge variant="outline" className="text-xs">Hace más de 1 semana</Badge>;
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
            Gestiona las claves de API para integraciones (n8n, webhooks, etc.)
          </p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Crear API Key
        </Button>
      </div>

      {/* Documentation Alert */}
      <Alert className="bg-blue-50 border-blue-200">
        <Info className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-blue-800">
          <div className="flex items-start gap-2">
            <BookOpen className="h-4 w-4 mt-0.5 shrink-0" />
            <div>
              <b>Cómo usar en n8n:</b>
              <ol className="list-decimal ml-4 mt-2 space-y-1">
                <li>Copia tu API Key cuando la crees (solo se muestra una vez)</li>
                <li>En n8n, usa el nodo &quot;HTTP Request&quot;</li>
                <li>Añade un header: <code className="bg-blue-100 px-1 rounded">X-API-Key</code> con tu clave</li>
                <li>URL base: <code className="bg-blue-100 px-1 rounded">{process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1'}</code></li>
              </ol>
            </div>
          </div>
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Mis API Keys</CardTitle>
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
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Prefijo</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Último uso</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Expira</TableHead>
                  <TableHead className="w-17.5"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                      Cargando API Keys...
                    </TableCell>
                  </TableRow>
                ) : filteredAPIKeys.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                      {searchTerm ? "No se encontraron API Keys" : "No tienes API Keys aún. Crea una para empezar."}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAPIKeys.map((apiKey) => (
                    <TableRow key={apiKey.id}>
                      <TableCell className="font-medium">{apiKey.name}</TableCell>
                      <TableCell>
                        <code className="text-sm bg-gray-100 px-2 py-1 rounded">
                          {apiKey.key_prefix}••••••••
                        </code>
                      </TableCell>
                      <TableCell>
                        <Badge className={getRoleBadgeColor(apiKey.role)}>
                          {apiKey.role}
                        </Badge>
                      </TableCell>
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
                          <Badge className="bg-green-100 text-green-700">Activa</Badge>
                        ) : (
                          <Badge variant="destructive">Revocada</Badge>
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
        apiEndpoint="/api/dashboard/api-keys"
      />

      <RevokeAPIKeyDialog
        apiKey={selectedApiKey}
        open={revokeDialogOpen}
        onOpenChange={setRevokeDialogOpen}
        onSuccess={fetchAPIKeys}
        apiEndpoint="/api/dashboard/api-keys"
      />
    </div>
  );
}

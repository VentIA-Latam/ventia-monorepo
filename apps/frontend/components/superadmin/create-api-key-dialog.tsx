import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { APIKeyCreate, APIKeyCreateResponse } from "@/lib/types/api-key";
import { Tenant } from "@/lib/types/tenant";
import { useState } from "react";
import { Copy, Check, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { REGULAR_ROLES, getRoleLabel } from "@/lib/constants/roles";

interface CreateAPIKeyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  apiEndpoint: string; // "/api/superadmin/api-keys" or "/api/dashboard/api-keys"
  tenants?: Tenant[]; // For superadmin - list of tenants to select from
}

export function CreateAPIKeyDialog({ open, onOpenChange, onSuccess, apiEndpoint, tenants = [] }: CreateAPIKeyDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<APIKeyCreate>({
    name: "",
    role: "VIEWER",
    tenant_id: undefined,
    expires_at: null,
  });
  const [createdKey, setCreatedKey] = useState<APIKeyCreateResponse | null>(null);
  const [copied, setCopied] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await fetch(apiEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        const data: APIKeyCreateResponse = await response.json();
        setCreatedKey(data);
        toast({
          title: "API Key creada exitosamente",
          description: "Guarda esta clave de forma segura. No podrás verla de nuevo.",
        });
      } else {
        const errorData = await response.json().catch(() => ({}));
        toast({
          title: "Error al crear API Key",
          description: errorData.error || "Ocurrió un error inesperado",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Error de red",
        description: "No se pudo conectar con el servidor",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (createdKey) {
      await navigator.clipboard.writeText(createdKey.key);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        title: "Copiado",
        description: "API Key copiada al portapapeles",
      });
    }
  };

  const handleClose = () => {
    setFormData({ name: "", role: "VIEWER", tenant_id: undefined, expires_at: null });
    setCreatedKey(null);
    setCopied(false);
    onOpenChange(false);
    if (createdKey) {
      onSuccess();
    }
  };

  // Si ya se creó la key, mostrar el resultado
  if (createdKey) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>✅ API Key Creada</DialogTitle>
            <DialogDescription>
              Guarda esta clave de forma segura. <b>No podrás verla de nuevo.</b>
            </DialogDescription>
          </DialogHeader>
          
          <Alert className="bg-warning-bg border-warning/30">
            <AlertCircle className="h-4 w-4 text-warning" />
            <AlertDescription className="text-warning">
              <b>Importante:</b> Esta es la única vez que verás la clave completa. Cópiala y guárdala en un lugar seguro.
            </AlertDescription>
          </Alert>

          <div className="space-y-4">
            <div>
              <Label>Nombre</Label>
              <Input value={createdKey.name} disabled />
            </div>
            
            <div>
              <Label>API Key (Cópiala ahora)</Label>
              <div className="flex gap-2">
                <Input 
                  value={createdKey.key} 
                  readOnly 
                  className="font-mono text-sm"
                />
                <Button 
                  type="button" 
                  variant="outline" 
                  size="icon"
                  onClick={handleCopy}
                >
                  {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Rol</Label>
                <Input value={getRoleLabel(createdKey.role)} disabled />
              </div>
              <div>
                <Label>Prefijo (para identificar)</Label>
                <Input value={createdKey.key_prefix} disabled className="font-mono" />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button onClick={handleClose}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // Formulario de creación
  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Crear Nueva API Key</DialogTitle>
          <DialogDescription>
            Crea una clave de API para integraciones externas (ej. n8n)
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Nombre *</Label>
            <Input
              id="name"
              placeholder="ej. n8n-production"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              disabled={loading}
            />
          </div>

          <div>
            <Label htmlFor="role">Rol *</Label>
            <Select
              value={formData.role}
              onValueChange={(value) => setFormData({ ...formData, role: value as any })}
              disabled={loading}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecciona un rol" />
              </SelectTrigger>
              <SelectContent>
                {REGULAR_ROLES.map((role) => (
                  <SelectItem key={role.value} value={role.value}>
                    {role.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {tenants.length > 0 && (
            <div>
              <Label htmlFor="tenant_id">Tenant (opcional)</Label>
              <Select
                value={formData.tenant_id?.toString() || "default"}
                onValueChange={(value) => setFormData({ ...formData, tenant_id: value === "default" ? undefined : parseInt(value) })}
                disabled={loading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un tenant" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Mi tenant (predeterminado)</SelectItem>
                  {tenants?.filter((t) => !t.is_platform).map((tenant) => (
                    <SelectItem key={tenant.id} value={tenant.id.toString()}>
                      {tenant.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Solo SUPER_ADMIN puede crear API keys para otros tenants
              </p>
            </div>
          )}

          <div>
            <Label htmlFor="expires_at">Fecha de expiración (opcional)</Label>
            <Input
              id="expires_at"
              type="datetime-local"
              value={formData.expires_at || ""}
              onChange={(e) => setFormData({ ...formData, expires_at: e.target.value || null })}
              disabled={loading}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Creando..." : "Crear API Key"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

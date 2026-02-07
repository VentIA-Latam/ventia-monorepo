"use client";

import { useState, useEffect } from "react";
import { updateUser, getTenants } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { User, UserUpdate } from "@/lib/types/user";
import { Tenant } from "@/lib/types/tenant";
import { REGULAR_ROLES } from "@/lib/constants/roles";

interface EditUserDialogProps {
  user: User | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  tenants: Tenant[];
}

export function EditUserDialog({ user, open, onOpenChange, onSuccess, tenants }: EditUserDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<UserUpdate>({
    name: "",
    email: "",
    role: "ADMIN",
    is_active: true,
    tenant_id: null,
    chatwoot_user_id: undefined,
    chatwoot_account_id: undefined,
  });

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name,
        email: user.email,
        role: user.role,
        is_active: user.is_active,
        tenant_id: user.tenant_id,
        chatwoot_user_id: user.chatwoot_user_id,
        chatwoot_account_id: user.chatwoot_account_id,
      });
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/superadmin/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al actualizar usuario');
      }
      toast({
        title: "Usuario actualizado",
        description: "Los cambios se han guardado correctamente",
      });
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Error al actualizar usuario",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Editar Usuario</DialogTitle>
            <DialogDescription>
              Modifica la información del usuario y guarda los cambios
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Nombre</Label>
              <Input id="name" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="tenant">Tenant/Empresa</Label>
              <Select
                value={formData.tenant_id?.toString() || "none"}
                onValueChange={(value) => setFormData({
                  ...formData,
                  tenant_id: value === "none" ? null : parseInt(value)
                })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar tenant" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin tenant (Super Admin)</SelectItem>
                  {tenants.map((tenant) => (
                    <SelectItem key={tenant.id} value={tenant.id.toString()}>
                      {tenant.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Selecciona el tenant al que pertenecerá el usuario.
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="role">Rol</Label>
              <Select value={formData.role} onValueChange={(value) => setFormData({ ...formData, role: value as UserUpdate["role"] })} required>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar rol" />
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

            {/* Chatwoot Integration - Required fields */}
            <div className="border-t pt-4 mt-2">
              <p className="text-sm font-medium text-foreground mb-3">Integración Chatwoot (Requerido)</p>
              <p className="text-xs text-muted-foreground mb-3">
                El usuario debe existir previamente en Chatwoot. Obtén estos IDs desde la plataforma de Chatwoot.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="chatwoot_user_id">User ID <span className="text-danger">*</span></Label>
                  <Input
                    id="chatwoot_user_id"
                    type="number"
                    placeholder="Ej: 1"
                    value={formData.chatwoot_user_id || ""}
                    onChange={e => setFormData({ ...formData, chatwoot_user_id: e.target.value ? parseInt(e.target.value) : undefined })}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="chatwoot_account_id">Account ID <span className="text-danger">*</span></Label>
                  <Input
                    id="chatwoot_account_id"
                    type="number"
                    placeholder="Ej: 1"
                    value={formData.chatwoot_account_id || ""}
                    onChange={e => setFormData({ ...formData, chatwoot_account_id: e.target.value ? parseInt(e.target.value) : undefined })}
                    required
                  />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={loading} className="bg-primary hover:bg-primary/90">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Guardar Cambios
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

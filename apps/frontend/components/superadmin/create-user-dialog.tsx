"use client";

import { useState } from "react";
import { createUser } from "@/lib/api-client";
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
import { UserCreate } from "@/lib/types/user";
import { Tenant } from "@/lib/types/tenant";
import { REGULAR_ROLES } from "@/lib/constants/roles";

interface CreateUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  tenants: Tenant[];
}

export function CreateUserDialog({ open, onOpenChange, onSuccess, tenants }: CreateUserDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<Partial<UserCreate>>({
    name: "",
    email: "",
    role: "ADMIN",
    tenant_id: undefined,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      // ✅ Usa Client API Layer
      await createUser(formData);

      toast({
        title: "Usuario creado",
        description: "El usuario se ha creado correctamente",
      });
      setFormData({ name: "", email: "", role: "ADMIN", tenant_id: undefined });
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Error al crear usuario",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Crear Nuevo Usuario</DialogTitle>
            <DialogDescription>
              Completa la información para crear un nuevo usuario en la plataforma
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Nombre <span className="text-danger">*</span></Label>
              <Input id="name" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">Email <span className="text-danger">*</span></Label>
              <Input id="email" type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="tenant">Tenant/Empresa <span className="text-danger">*</span></Label>
              <Select
                value={formData.tenant_id?.toString() || ""}
                onValueChange={(value) => setFormData({
                  ...formData,
                  tenant_id: parseInt(value)
                })}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar tenant" />
                </SelectTrigger>
                <SelectContent>
                  {tenants.filter((t) => !t.is_platform).map((tenant) => (
                    <SelectItem key={tenant.id} value={tenant.id.toString()}>
                      {tenant.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Todos los usuarios deben estar asociados a un tenant específico
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="role">Rol <span className="text-danger">*</span></Label>
              <Select value={formData.role} onValueChange={(value) => setFormData({ ...formData, role: value as UserCreate["role"] })} required>
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

          </div>
          <DialogFooter>
            <Button type="submit" disabled={loading} className="bg-success hover:bg-success/90">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Crear Usuario
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

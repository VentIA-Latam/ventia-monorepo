"use client";

import { useState } from "react";
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
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { UserCreate } from "@/lib/types/user";

interface CreateUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function CreateUserDialog({ open, onOpenChange, onSuccess }: CreateUserDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<UserCreate>({
    name: "",
    email: "",
    role: "ADMIN",
    tenant_id: null,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await fetch('/api/superadmin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al crear usuario');
      }
      toast({
        title: "Usuario creado",
        description: "El usuario se ha creado correctamente",
      });
      setFormData({ name: "", email: "", role: "ADMIN", tenant_id: null });
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
              <Label htmlFor="name">Nombre <span className="text-red-500">*</span></Label>
              <Input id="name" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">Email <span className="text-red-500">*</span></Label>
              <Input id="email" type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} required />
              <p className="text-xs text-gray-500">
                Auth0 enviará un email de verificación al usuario para que configure su contraseña
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="role">Rol <span className="text-red-500">*</span></Label>
              <select id="role" className="border rounded px-2 py-1" value={formData.role} onChange={e => setFormData({ ...formData, role: e.target.value as UserCreate["role"] })} required>
                <option value="SUPER_ADMIN">Super Admin</option>
                <option value="ADMIN">Admin</option>
                <option value="LOGISTICA">Logística</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={loading} className="bg-green-600 hover:bg-green-700">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Crear Usuario
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

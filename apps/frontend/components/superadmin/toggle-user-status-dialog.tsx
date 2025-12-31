import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { User } from "@/lib/types/user";
import { useState } from "react";

interface ToggleUserStatusDialogProps {
  user: User | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function ToggleUserStatusDialog({ user, open, onOpenChange, onSuccess }: ToggleUserStatusDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  if (!user) return null;

  const handleToggle = async () => {
    setLoading(true);
    try {
      let response;
      if (user.is_active) {
        // Desactivar (soft delete)
        response = await fetch(`/api/superadmin/users/${user.id}`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
        });
      } else {
        // Activar (PUT)
        response = await fetch(`/api/superadmin/users/${user.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ is_active: true }),
        });
      }
      if (response.ok || response.status === 204) {
        toast({
          title: `Usuario ${user.is_active ? "desactivado" : "activado"} correctamente`,
        });
        onSuccess();
        onOpenChange(false);
      } else {
        let errorMsg = "Error al cambiar el estado del usuario";
        try {
          const data = await response.json();
          errorMsg = data?.error || errorMsg;
        } catch { }
        toast({ title: errorMsg, variant: "destructive" });
      }
    } catch {
      toast({ title: "Error de red", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {user.is_active ? "Desactivar usuario" : "Activar usuario"}
          </DialogTitle>
        </DialogHeader>
        <div className="py-4">
          ¿Estás seguro que deseas {user.is_active ? "desactivar" : "activar"} al usuario <b>{user.name}</b>?
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button variant={user.is_active ? "destructive" : "default"} onClick={handleToggle} disabled={loading}>
            {user.is_active ? "Desactivar" : "Activar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

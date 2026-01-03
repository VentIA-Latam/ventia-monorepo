import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { User } from "@/lib/types/user";

interface UserDetailDialogProps {
  user: User | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UserDetailDialog({ user, open, onOpenChange }: UserDetailDialogProps) {
  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-0">
        <div className="flex flex-col gap-0">
          <div className="flex items-center justify-between px-6 pt-6 pb-2">
            <div className="flex flex-col gap-1">
              <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                {user.name}
                <Badge variant={user.is_active ? "default" : "destructive"} className={user.is_active ? "bg-green-100 text-green-700" : ""}>
                  {user.is_active ? "Activo" : "Inactivo"}
                </Badge>
              </h2>
              <span className="text-xs text-gray-500">ID: {user.id}</span>
            </div>
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cerrar
            </Button>
          </div>
          <div className="border-t px-6 py-4 grid grid-cols-1 gap-4">
            <div>
              <div className="text-xs text-gray-500 mb-1">Email</div>
              <div className="text-base font-medium">{user.email}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">Rol</div>
              <div className="inline-flex items-center gap-2">
                <Badge variant="secondary">{user.role}</Badge>
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">Creado</div>
              <div className="text-sm">{user.created_at ? new Date(user.created_at).toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' }) : "-"}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">Actualizado</div>
              <div className="text-sm">{user.updated_at ? new Date(user.updated_at).toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' }) : "-"}</div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

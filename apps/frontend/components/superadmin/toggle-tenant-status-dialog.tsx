"use client";

import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Tenant } from "@/lib/types/tenant";

interface ToggleTenantStatusDialogProps {
  tenant: Tenant | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function ToggleTenantStatusDialog({
  tenant,
  open,
  onOpenChange,
  onSuccess,
}: ToggleTenantStatusDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    if (!tenant) return;

    setLoading(true);

    try {
      const response = await fetch(`/api/superadmin/tenants/${tenant.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !tenant.is_active }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al actualizar estado');
      }

      toast({
        title: tenant.is_active ? "Tenant desactivado" : "Tenant activado",
        description: `${tenant.name} ha sido ${tenant.is_active ? "desactivado" : "activado"} correctamente`,
      });

      onSuccess();
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Error al cambiar estado",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!tenant) return null;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {tenant.is_active ? "¿Desactivar tenant?" : "¿Activar tenant?"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {tenant.is_active ? (
              <>
                Estás a punto de <strong>desactivar</strong> el tenant <strong>{tenant.name}</strong>.
                <br /><br />
                Los usuarios de este tenant no podrán acceder al sistema hasta que sea reactivado.
              </>
            ) : (
              <>
                Estás a punto de <strong>activar</strong> el tenant <strong>{tenant.name}</strong>.
                <br /><br />
                Los usuarios de este tenant podrán acceder al sistema nuevamente.
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={loading}
            className={tenant.is_active ? "bg-red-600 hover:bg-red-700" : "bg-green-600 hover:bg-green-700"}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {tenant.is_active ? "Desactivar" : "Activar"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

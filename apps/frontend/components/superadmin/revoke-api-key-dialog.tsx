import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { APIKey } from "@/lib/types/api-key";
import { useState } from "react";
import { AlertTriangle } from "lucide-react";

interface RevokeAPIKeyDialogProps {
  apiKey: APIKey | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  apiEndpoint: string; // Base endpoint, will append /{id}
}

export function RevokeAPIKeyDialog({ apiKey, open, onOpenChange, onSuccess, apiEndpoint }: RevokeAPIKeyDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  if (!apiKey) return null;

  const handleRevoke = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${apiEndpoint}/${apiKey.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      });

      if (response.ok || response.status === 204) {
        toast({
          title: "API Key revocada",
          description: `La clave "${apiKey.name}" ha sido desactivada`,
        });
        onSuccess();
        onOpenChange(false);
      } else {
        const errorData = await response.json().catch(() => ({}));
        toast({
          title: "Error al revocar API Key",
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            Revocar API Key
          </DialogTitle>
          <DialogDescription>
            Esta acción no se puede deshacer. La clave será desactivada permanentemente.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-2">
          <p>¿Estás seguro que deseas revocar la siguiente API Key?</p>
          <div className="bg-gray-50 p-3 rounded-md border">
            <div className="font-semibold">{apiKey.name}</div>
            <div className="text-sm text-gray-600 font-mono">{apiKey.key_prefix}••••••••</div>
            <div className="text-sm text-gray-500 mt-1">Rol: {apiKey.role}</div>
          </div>
          <p className="text-sm text-gray-600 mt-2">
            Las integraciones que usen esta clave dejarán de funcionar inmediatamente.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={handleRevoke} disabled={loading}>
            {loading ? "Revocando..." : "Revocar API Key"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

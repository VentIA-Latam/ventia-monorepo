"use client";

import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { useAccessToken } from "@/hooks/use-access-token";
import { useToast } from "@/hooks/use-toast";
import { deleteCampaign } from "@/lib/services/campaigns-service";

interface Props {
  campaignId: number;
  recipientsCount: number;
  onDeleted: () => void;
  children: React.ReactNode;
}

/**
 * AlertDialog destructivo. Si la campaña tiene >100 destinatarios, requiere
 * confirmación adicional escribiendo "BORRAR" (anti-trigger-feliz).
 */
export function DeleteCampaignDialog({
  campaignId,
  recipientsCount,
  onDeleted,
  children,
}: Props) {
  const accessToken = useAccessToken();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [open, setOpen] = useState(false);
  const [typedConfirm, setTypedConfirm] = useState("");

  const needsConfirm = recipientsCount > 100;
  const canSubmit = !needsConfirm || typedConfirm === "BORRAR";

  const onConfirm = async () => {
    if (!accessToken || !canSubmit) return;
    setSubmitting(true);
    try {
      await deleteCampaign(accessToken, campaignId);
      setOpen(false);
      onDeleted();
    } catch (e) {
      toast({
        title: "No se pudo borrar",
        description: e instanceof Error ? e.message : "Intentá de nuevo",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AlertDialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setTypedConfirm("");
      }}
    >
      <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Borrar campaña</AlertDialogTitle>
          <AlertDialogDescription>
            Vas a borrar esta campaña y sus{" "}
            <strong className="text-foreground tabular-nums">{recipientsCount}</strong>{" "}
            destinatarios. Esta acción no se puede deshacer.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {needsConfirm && (
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">
              Escribí <strong className="text-foreground">BORRAR</strong> para confirmar:
            </label>
            <Input
              value={typedConfirm}
              onChange={(e) => setTypedConfirm(e.target.value)}
              placeholder="BORRAR"
              autoFocus
            />
          </div>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={submitting}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={!canSubmit || submitting}
            className="bg-[var(--danger)] text-background hover:bg-[var(--danger)]/90"
          >
            {submitting ? "Borrando..." : "Borrar campaña"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

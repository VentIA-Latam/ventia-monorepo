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
import { useAccessToken } from "@/hooks/use-access-token";
import { useToast } from "@/hooks/use-toast";
import { retryFailedCampaign } from "@/lib/services/campaigns-service";

interface Props {
  campaignId: number;
  failedCount: number;
  onRetried: (count: number) => void;
  children: React.ReactNode;
}

export function RetryFailedDialog({
  campaignId,
  failedCount,
  onRetried,
  children,
}: Props) {
  const accessToken = useAccessToken();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [open, setOpen] = useState(false);

  const onConfirm = async () => {
    if (!accessToken) return;
    setSubmitting(true);
    try {
      const res = await retryFailedCampaign(accessToken, campaignId);
      onRetried(res.data.retrying);
      setOpen(false);
    } catch (e) {
      toast({
        title: "No se pudo reintentar",
        description: e instanceof Error ? e.message : "Intentá de nuevo",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Reintentar destinatarios fallidos</AlertDialogTitle>
          <AlertDialogDescription>
            Vas a reintentar el envío a{" "}
            <strong className="text-foreground tabular-nums">{failedCount}</strong>{" "}
            destinatarios que fallaron. Los que ya se enviaron correctamente no se vuelven a procesar.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={submitting}>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={submitting}>
            {submitting ? "Encolando..." : "Reintentar"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

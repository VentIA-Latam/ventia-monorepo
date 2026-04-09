"use client";

import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";

export default function ConversationsError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <div className="p-3 rounded-full bg-danger-bg">
        <AlertCircle className="h-8 w-8 text-danger" />
      </div>
      <h2 className="text-xl font-bold text-foreground font-heading">
        Error al cargar conversaciones
      </h2>
      <p className="text-muted-foreground text-center max-w-md">
        No se pudo conectar con el servicio de mensajería. Verifica que el servicio esté activo e intenta nuevamente.
      </p>
      <Button onClick={reset} className="mt-2">
        Intentar de nuevo
      </Button>
    </div>
  );
}

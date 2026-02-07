"use client";

import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";

export default function DashboardError({
  error,
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
        Algo salió mal
      </h2>
      <p className="text-muted-foreground text-center max-w-md">
        Ocurrió un error al cargar esta página. Intenta nuevamente o contacta soporte si el problema persiste.
      </p>
      <Button onClick={reset} className="mt-2">
        Intentar de nuevo
      </Button>
    </div>
  );
}


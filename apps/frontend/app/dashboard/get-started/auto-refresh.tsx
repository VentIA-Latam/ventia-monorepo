"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

interface AutoRefreshProps {
  intervalMs?: number; // Intervalo en milisegundos (default: 60000 = 1 minuto)
}

/**
 * Componente que refresca automáticamente la página usando router.refresh()
 * 
 * Este componente:
 * - Se monta silenciosamente en la página
 * - Refresca los datos del servidor automáticamente
 * - No causa full page reload, solo actualiza los Server Components
 * - Limpia el intervalo cuando se desmonta
 */
export function AutoRefresh({ intervalMs = 60000 }: AutoRefreshProps) {
  const router = useRouter();

  useEffect(() => {
    // Configurar intervalo para refresh automático
    const interval = setInterval(() => {
      router.refresh();
    }, intervalMs);

    // Limpiar intervalo al desmontar
    return () => clearInterval(interval);
  }, [intervalMs, router]);

  // Este componente no renderiza nada
  return null;
}

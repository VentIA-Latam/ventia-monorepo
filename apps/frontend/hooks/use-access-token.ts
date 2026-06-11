"use client";

import { useEffect, useState } from "react";

/**
 * Client-side hook para obtener el access token de Auth0.
 * El endpoint `/api/auth/token` proxea a la sesión (Auth0 SDK) y devuelve
 * `{ accessToken }`. Devuelve `null` mientras carga o si falló.
 *
 * Patrón usado también en `components/dashboard/invoices/create-invoice-dialog.tsx`.
 */
export function useAccessToken(): string | null {
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/auth/token", { credentials: "include" });
        if (!res.ok) return;
        const data = (await res.json()) as { accessToken?: string };
        if (!cancelled && data.accessToken) setToken(data.accessToken);
      } catch {
        // silent: caller checks for null
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return token;
}

"use client";

import { createContext, useContext, type ReactNode } from "react";

const TenantTimezoneContext = createContext<string | null>(null);

export function TenantTimezoneProvider({
  timezone,
  children,
}: {
  timezone: string;
  children: ReactNode;
}) {
  return (
    <TenantTimezoneContext.Provider value={timezone}>
      {children}
    </TenantTimezoneContext.Provider>
  );
}

export function useTenantTimezone(): string {
  // Fallback to "America/Lima" when no provider is present (e.g., superadmin views
  // reusing dashboard components). Superadmin operates across multiple tenants and
  // doesn't have a single timezone to provide.
  return useContext(TenantTimezoneContext) ?? "America/Lima";
}

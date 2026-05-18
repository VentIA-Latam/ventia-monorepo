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
  const tz = useContext(TenantTimezoneContext);
  if (tz === null) {
    throw new Error("useTenantTimezone must be used within a TenantTimezoneProvider");
  }
  return tz;
}

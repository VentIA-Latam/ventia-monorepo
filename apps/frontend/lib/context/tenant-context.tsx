"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { TenantOption } from "@/components/superadmin/tenant-selector";

interface TenantContextValue {
  selectedTenantId: number | null;
  setSelectedTenantId: (id: number | null) => void;
  tenants: TenantOption[];
  selectedTenant: TenantOption | null;
}

const TenantContext = createContext<TenantContextValue | null>(null);

export function TenantProvider({
  tenants,
  children,
}: {
  tenants: TenantOption[];
  children: ReactNode;
}) {
  const [selectedTenantId, setSelectedTenantId] = useState<number | null>(null);

  // Derived state without useEffect (rerender-derived-state)
  const selectedTenant = selectedTenantId
    ? tenants.find((t) => t.id === selectedTenantId) ?? null
    : null;

  const value = useMemo(
    () => ({ selectedTenantId, setSelectedTenantId, tenants, selectedTenant }),
    [selectedTenantId, tenants, selectedTenant]
  );

  return (
    <TenantContext.Provider value={value}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  const context = useContext(TenantContext);
  if (!context) {
    throw new Error("useTenant must be used within a TenantProvider");
  }
  return context;
}

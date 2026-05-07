"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { TenantOption } from "@/components/superadmin/tenant-selector";
import { getTenants } from "@/lib/api-client/superadmin";

interface TenantContextValue {
  selectedTenantId: number | null;
  setSelectedTenantId: (id: number | null) => void;
  tenants: TenantOption[];
  selectedTenant: TenantOption | null;
  refreshTenants: () => Promise<void>;
}

const TenantContext = createContext<TenantContextValue | null>(null);

export function TenantProvider({
  tenants: initialTenants,
  children,
}: {
  tenants: TenantOption[];
  children: ReactNode;
}) {
  const [tenants, setTenants] = useState<TenantOption[]>(initialTenants);
  const [selectedTenantId, setSelectedTenantId] = useState<number | null>(null);

  const refreshTenants = useCallback(async () => {
    try {
      const data = await getTenants({ limit: 100, is_active: true });
      setTenants(
        (data.items ?? [])
          .filter((t) => !t.is_platform)
          .map((t) => ({ id: t.id, name: t.name }))
      );
    } catch {
      // silently ignore — selectors keep showing previous list
    }
  }, []);

  const value = useMemo(() => {
    const selectedTenant = selectedTenantId
      ? tenants.find((t) => t.id === selectedTenantId) ?? null
      : null;
    return { selectedTenantId, setSelectedTenantId, tenants, selectedTenant, refreshTenants };
  }, [selectedTenantId, tenants, refreshTenants]);

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

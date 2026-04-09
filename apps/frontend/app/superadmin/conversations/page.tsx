"use client";

import { Building2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { EmptyState } from "@/components/ui/empty-state";
import { useTenant } from "@/lib/context/tenant-context";
import { SuperAdminConversationsClient } from "./conversations-client";

export default function SuperAdminConversationsPage() {
  const { selectedTenantId } = useTenant();
  const searchParams = useSearchParams();
  const section = searchParams.get("section") ?? "all";

  return selectedTenantId ? (
    <SuperAdminConversationsClient
      key={`${selectedTenantId}-${section}`}
      tenantId={selectedTenantId}
      section={section}
    />
  ) : (
    <div className="flex items-center justify-center h-full">
      <EmptyState
        icon={<Building2 className="h-8 w-8" />}
        title="Selecciona una empresa"
        description="Elige una empresa en el selector del panel lateral para ver sus conversaciones."
      />
    </div>
  );
}

"use client";

import { Building2, MessageSquare } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { useTenant } from "@/lib/context/tenant-context";

export default function SuperAdminConversationsPage() {
  const { selectedTenantId, selectedTenant } = useTenant();

  return selectedTenantId ? (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-foreground font-heading flex items-center gap-2">
          <MessageSquare className="h-6 w-6" />
          Conversaciones — {selectedTenant?.name}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gestiona las conversaciones de esta empresa
        </p>
      </div>
      <div className="flex items-center justify-center h-[40vh]">
        <EmptyState
          icon={<MessageSquare className="h-8 w-8" />}
          title="Proximamente"
          description="La vista de conversaciones por tenant estara disponible pronto."
        />
      </div>
    </div>
  ) : (
    <div className="flex items-center justify-center h-[60vh]">
      <EmptyState
        icon={<Building2 className="h-8 w-8" />}
        title="Selecciona una empresa"
        description="Elige una empresa en el selector del panel lateral para ver sus conversaciones."
      />
    </div>
  );
}

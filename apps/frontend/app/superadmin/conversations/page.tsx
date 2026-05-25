"use client";

import { Building2 } from "lucide-react";
import { useSearchParams, useRouter } from "next/navigation";
import { useEffect } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { useTenant } from "@/lib/context/tenant-context";
import { SuperAdminConversationsClient } from "./conversations-client";

export default function SuperAdminConversationsPage() {
  const { selectedTenantId, setSelectedTenantId } = useTenant();
  const router = useRouter();
  const searchParams = useSearchParams();
  const section = searchParams.get("section") ?? "all";
  const id = searchParams.get("id");
  const urlTenantId = searchParams.get("tenant_id");

  // Al abrir un link compartido, auto-seleccionar el tenant de la URL.
  // Solo aplica cuando no hay tenant seleccionado — evita revertir cambios explícitos del sidebar
  // cuando MessagingProvider remonta al cambiar de tenant.
  useEffect(() => {
    if (!urlTenantId || selectedTenantId !== null) return;
    const parsed = Number(urlTenantId);
    if (!isNaN(parsed) && parsed > 0) {
      setSelectedTenantId(parsed);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // solo al montar — intencional

  // Cuando el tenant cambia desde el sidebar, sincronizar la URL (limpia el ?id obsoleto)
  useEffect(() => {
    if (!selectedTenantId) return;
    const urlTenant = urlTenantId ? Number(urlTenantId) : null;
    if (selectedTenantId !== urlTenant) {
      router.replace(
        `/superadmin/conversations?section=${section}&tenant_id=${selectedTenantId}`,
        { scroll: false }
      );
    }
  }, [selectedTenantId, urlTenantId, section, router]);

  // Usar urlTenantId como fallback síncronamente para evitar flash del empty state
  const parsedUrlTenant = urlTenantId ? Number(urlTenantId) : null;
  const effectiveTenantId = selectedTenantId ?? (parsedUrlTenant && parsedUrlTenant > 0 ? parsedUrlTenant : null);
  const parsedId = id && !isNaN(Number(id)) ? Number(id) : undefined;

  // Solo pasar initialConversationId si la URL es consistente con el tenant actual.
  // Si el tenant cambió desde el sidebar pero la URL aún no se actualizó, parsedId sería
  // de otro tenant — pasar undefined evita que se intente abrir esa conversación.
  const urlIsConsistent = parsedUrlTenant !== null && parsedUrlTenant === effectiveTenantId;
  const initialConversationId = urlIsConsistent ? parsedId : undefined;

  return effectiveTenantId ? (
    <SuperAdminConversationsClient
      key={`${effectiveTenantId}-${section}`}
      tenantId={effectiveTenantId}
      section={section}
      initialConversationId={initialConversationId}
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

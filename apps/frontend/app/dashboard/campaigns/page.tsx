import { Megaphone } from "lucide-react";
import { getAccessToken } from "@/lib/auth0";
import { fetchCampaigns } from "@/lib/services/campaigns-service";
import { CampaignsListClient } from "./campaigns-list-client";
import type { Campaign } from "@/lib/types/campaign";

export const dynamic = "force-dynamic";

const ERROR_MESSAGES: Record<string, string> = {
  no_whatsapp_inbox:
    "Para crear campañas, primero configurá un inbox de WhatsApp en Configuración → Canales.",
  create_failed:
    "No pudimos crear la campaña. Verificá tu conexión e intentalo de nuevo.",
  load_failed: "No pudimos cargar los inboxes disponibles.",
};

export default async function CampaignsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const sp = await searchParams;
  const errorBanner = sp.error ? ERROR_MESSAGES[sp.error] ?? null : null;

  let initialCampaigns: Campaign[] = [];
  let loadError: string | null = null;

  try {
    const token = await getAccessToken();
    if (token) {
      const response = await fetchCampaigns(token);
      initialCampaigns = response.data ?? [];
    } else {
      loadError = "Sesión expirada. Iniciá sesión nuevamente.";
    }
  } catch (e) {
    loadError = e instanceof Error ? e.message : "No se pudieron cargar las campañas.";
  }

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-volt/10 p-3">
            <Megaphone className="h-6 w-6 text-volt" />
          </div>
          <div>
            <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">
              Campañas
            </h1>
            <p className="text-sm text-muted-foreground">
              Envíos masivos de WhatsApp con templates aprobados
            </p>
          </div>
        </div>
      </header>

      {errorBanner && (
        <div className="rounded-lg border border-[var(--warning)]/30 bg-[var(--warning-bg)] px-4 py-3 text-sm text-[var(--warning)]">
          {errorBanner}
        </div>
      )}

      <CampaignsListClient initialCampaigns={initialCampaigns} loadError={loadError} />
    </div>
  );
}

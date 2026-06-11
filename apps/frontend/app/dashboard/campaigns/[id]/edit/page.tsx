import { redirect, notFound } from "next/navigation";
import { getAccessToken } from "@/lib/auth0";
import { fetchCampaign, CampaignApiError } from "@/lib/services/campaigns-service";
import {
  fetchInboxes,
  fetchInboxTemplates,
  fetchLabels,
} from "@/lib/services/messaging-service";
import { WizardClient } from "./wizard-client";

export const dynamic = "force-dynamic";

export default async function EditCampaignPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ step?: string }>;
}) {
  const { id: idStr } = await params;
  const sp = await searchParams;
  const id = Number(idStr);
  if (!Number.isFinite(id)) notFound();

  const token = await getAccessToken();
  if (!token) redirect("/api/auth/login");

  // Cargar campaign primero — los demás dependen del inbox seleccionado.
  let campaign;
  try {
    const response = await fetchCampaign(token, id);
    campaign = response.data;
  } catch (e) {
    if (e instanceof CampaignApiError && e.status === 404) notFound();
    throw e;
  }

  // Solo se edita en :draft. Si está más adelante, redirigir al detalle.
  if (campaign.campaign_status !== "draft") {
    redirect(`/dashboard/campaigns/${id}`);
  }

  // Paralelizar: inboxes (para selector en step 1), templates del inbox actual, labels.
  const [inboxesResult, templatesResult, labelsResult] = await Promise.allSettled([
    fetchInboxes(token),
    fetchInboxTemplates(token, campaign.inbox.id),
    fetchLabels(token),
  ]);

  const inboxes =
    inboxesResult.status === "fulfilled"
      ? extractData(inboxesResult.value)
      : [];
  const templates =
    templatesResult.status === "fulfilled"
      ? extractData(templatesResult.value)
      : [];
  const labels =
    labelsResult.status === "fulfilled"
      ? extractData(labelsResult.value)
      : [];

  const currentStep = parseStep(sp.step) ?? 1;

  return (
    <WizardClient
      campaign={campaign}
      inboxes={inboxes}
      templates={templates}
      labels={labels}
      initialStep={currentStep}
    />
  );
}

function parseStep(raw: string | undefined): number | null {
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1 || n > 6) return null;
  return n;
}

function extractData(result: unknown): unknown[] {
  if (Array.isArray(result)) return result;
  if (result && typeof result === "object") {
    const data = (result as { data?: unknown }).data;
    if (Array.isArray(data)) return data;
  }
  return [];
}

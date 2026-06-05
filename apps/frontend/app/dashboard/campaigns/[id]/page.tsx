import { redirect, notFound } from "next/navigation";
import { getAccessToken } from "@/lib/auth0";
import {
  fetchCampaign,
  fetchCampaignRecipients,
  CampaignApiError,
} from "@/lib/services/campaigns-service";
import { CampaignDetailClient } from "./campaign-detail-client";

export const dynamic = "force-dynamic";

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!Number.isFinite(id)) notFound();

  const token = await getAccessToken();
  if (!token) redirect("/api/auth/login");

  // Disparar ambas requests en paralelo — `recipients` no depende del payload de campaña.
  // Attacheamos un `.catch` no-op a `recipientsPromise` para que la rejection quede
  // "handled" en caso de redirect a :draft (evita unhandled promise rejection warning).
  // El await final de recipientsPromise SÍ lanza el error real si la request falló.
  const campaignPromise = fetchCampaign(token, id);
  const recipientsPromise = fetchCampaignRecipients(token, id, {
    page: 1,
    per_page: 25,
  });
  recipientsPromise.catch(() => {
    /* handled below or discarded on redirect */
  });

  let campaign;
  try {
    const res = await campaignPromise;
    campaign = res.data;
  } catch (e) {
    if (e instanceof CampaignApiError && e.status === 404) notFound();
    throw e;
  }

  if (campaign.campaign_status === "draft") {
    redirect(`/dashboard/campaigns/${id}/edit?step=1`);
  }

  const recipientsRes = await recipientsPromise;

  const meta = recipientsRes.meta ?? {
    current_page: 1,
    next_page: null,
    prev_page: null,
    total_pages: 1,
    total_count: recipientsRes.data.length,
  };

  return (
    <CampaignDetailClient
      initialCampaign={campaign}
      initialRecipients={recipientsRes.data}
      initialMeta={meta}
    />
  );
}

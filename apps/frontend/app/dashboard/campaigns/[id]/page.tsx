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

  let campaign;
  try {
    const res = await fetchCampaign(token, id);
    campaign = res.data;
  } catch (e) {
    if (e instanceof CampaignApiError && e.status === 404) notFound();
    throw e;
  }

  if (campaign.campaign_status === "draft") {
    redirect(`/dashboard/campaigns/${id}/edit?step=1`);
  }

  const recipientsRes = await fetchCampaignRecipients(token, id, {
    page: 1,
    per_page: 25,
  });

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

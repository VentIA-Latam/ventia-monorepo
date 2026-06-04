import { redirect } from "next/navigation";
import { getAccessToken } from "@/lib/auth0";
import { fetchInboxes } from "@/lib/services/messaging-service";
import { createCampaign } from "@/lib/services/campaigns-service";

// Server Component: crea draft inmediato y redirige al wizard step 1.
// Si el tenant no tiene WhatsApp inboxes, redirige a /campaigns con un flag de error.
export const dynamic = "force-dynamic";

type InboxShape = { id: number; name: string; channel_type?: string };

function isWhatsAppInbox(inbox: unknown): inbox is InboxShape {
  if (!inbox || typeof inbox !== "object") return false;
  const i = inbox as Record<string, unknown>;
  return (
    typeof i.id === "number" &&
    typeof i.name === "string" &&
    (i.channel_type === undefined || i.channel_type === "Channel::Whatsapp")
  );
}

export default async function NewCampaignPage() {
  const token = await getAccessToken();
  if (!token) {
    redirect("/api/auth/login");
  }

  let inboxes: InboxShape[] = [];
  try {
    const result = await fetchInboxes(token);
    const data = Array.isArray(result) ? result : (result as { data?: unknown }).data;
    if (Array.isArray(data)) {
      inboxes = data.filter(isWhatsAppInbox);
    }
  } catch {
    redirect("/dashboard/campaigns?error=load_failed");
  }

  if (inboxes.length === 0) {
    redirect("/dashboard/campaigns?error=no_whatsapp_inbox");
  }

  // Pick the first WhatsApp inbox as default; user puede cambiarlo en step 1.
  const defaultInbox = inboxes[0];

  let campaignId: number | null = null;
  try {
    const response = await createCampaign(token, {
      title: "Nueva campaña sin nombre",
      inbox_id: defaultInbox.id,
    });
    campaignId = response.data.id;
  } catch {
    redirect("/dashboard/campaigns?error=create_failed");
  }

  redirect(`/dashboard/campaigns/${campaignId}/edit?step=1`);
}

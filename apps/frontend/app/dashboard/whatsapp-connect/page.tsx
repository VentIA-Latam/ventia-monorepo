import { getAccessToken } from "@/lib/auth0";
import { fetchWhatsAppStatus } from "@/lib/services/messaging-service";
import { WhatsAppConnectClient } from "./whatsapp-connect-client";
import type { WhatsAppChannel } from "@/lib/types/messaging";

export const dynamic = "force-dynamic";

export default async function WhatsAppConnectPage() {
  let channels: WhatsAppChannel[] = [];

  try {
    const accessToken = await getAccessToken();
    if (accessToken) {
      const result = await fetchWhatsAppStatus(accessToken);
      channels = result?.data ?? [];
    }
  } catch (err) {
    console.error("Error loading WhatsApp channels:", err);
  }

  return <WhatsAppConnectClient initialChannels={channels} />;
}

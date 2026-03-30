import { getAccessToken } from "@/lib/auth0";
import { fetchWhatsAppStatus, ensureMessagingProvisioned } from "@/lib/services/messaging-service";
import { WhatsAppConnectClient } from "./whatsapp-connect-client";
import type { WhatsAppChannel } from "@/lib/types/messaging";

export const dynamic = "force-dynamic";

export default async function WhatsAppConnectPage() {
  let channels: WhatsAppChannel[] = [];

  try {
    const accessToken = await getAccessToken();
    if (accessToken) {
      try {
        const result = await fetchWhatsAppStatus(accessToken);
        channels = result?.data ?? [];
      } catch {
        // Account likely not provisioned — provision and retry
        await ensureMessagingProvisioned(accessToken);
        try {
          const result = await fetchWhatsAppStatus(accessToken);
          channels = result?.data ?? [];
        } catch (retryErr) {
          console.error("Error loading WhatsApp channels after provisioning:", retryErr);
        }
      }
    }
  } catch (err) {
    console.error("Error loading WhatsApp channels:", err);
  }

  return <WhatsAppConnectClient initialChannels={channels} />;
}

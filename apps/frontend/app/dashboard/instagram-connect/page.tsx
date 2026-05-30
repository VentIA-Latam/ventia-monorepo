import { getAccessToken } from "@/lib/auth0";
import { fetchInstagramStatus, ensureMessagingProvisioned } from "@/lib/services/messaging-service";
import { InstagramConnectClient } from "./instagram-connect-client";
import type { InstagramChannel } from "@/lib/types/messaging";

export const dynamic = "force-dynamic";

export default async function InstagramConnectPage() {
  let channels: InstagramChannel[] = [];

  try {
    const accessToken = await getAccessToken();
    if (accessToken) {
      try {
        const result = await fetchInstagramStatus(accessToken);
        channels = result?.data ?? [];
      } catch {
        // Account likely not provisioned — provision and retry
        await ensureMessagingProvisioned(accessToken);
        try {
          const result = await fetchInstagramStatus(accessToken);
          channels = result?.data ?? [];
        } catch (retryErr) {
          console.error("Error loading Instagram channels after provisioning:", retryErr);
        }
      }
    }
  } catch (err) {
    console.error("Error loading Instagram channels:", err);
  }

  return <InstagramConnectClient initialChannels={channels} />;
}

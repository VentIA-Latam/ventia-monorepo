import { getAccessToken } from "@/lib/auth0";
import {
  fetchWhatsAppStatus,
  fetchInstagramStatus,
  ensureMessagingProvisioned,
} from "@/lib/services/messaging-service";
import { ChannelsClient } from "./channels-client";
import type { WhatsAppChannel, InstagramChannel } from "@/lib/types/messaging";

export const dynamic = "force-dynamic";

async function fetchAll(accessToken: string) {
  const [wa, ig] = await Promise.all([
    fetchWhatsAppStatus(accessToken).catch(() => null),
    fetchInstagramStatus(accessToken).catch(() => null),
  ]);
  return {
    whatsapp: wa?.data ?? ([] as WhatsAppChannel[]),
    instagram: ig?.data ?? ([] as InstagramChannel[]),
  };
}

export default async function ChannelsPage() {
  let whatsappChannels: WhatsAppChannel[] = [];
  let instagramChannels: InstagramChannel[] = [];

  try {
    const accessToken = await getAccessToken();
    if (accessToken) {
      try {
        const result = await fetchAll(accessToken);
        whatsappChannels = result.whatsapp;
        instagramChannels = result.instagram;
      } catch {
        // First request failed — likely the account isn't provisioned yet.
        // Provision and retry once.
        await ensureMessagingProvisioned(accessToken);
        try {
          const result = await fetchAll(accessToken);
          whatsappChannels = result.whatsapp;
          instagramChannels = result.instagram;
        } catch (retryErr) {
          console.error("Error loading channels after provisioning:", retryErr);
        }
      }
    }
  } catch (err) {
    console.error("Error loading channels:", err);
  }

  return (
    <ChannelsClient
      whatsappChannels={whatsappChannels}
      instagramChannels={instagramChannels}
    />
  );
}

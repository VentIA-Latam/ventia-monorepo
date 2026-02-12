import { getAccessToken } from "@/lib/auth0";
import { fetchConversations, fetchInboxes } from "@/lib/services/messaging-service";
import { ConversationsClient } from "./conversations-client";

export const dynamic = "force-dynamic";

export default async function ConversationsPage() {
  let initialConversations: unknown[] = [];
  let initialInboxes: unknown[] = [];

  try {
    const token = await getAccessToken();
    if (token) {
      const [convResponse, inboxesResponse] = await Promise.all([
        fetchConversations(token, { status: "open" }),
        fetchInboxes(token),
      ]);
      initialConversations = convResponse.data ?? [];
      initialInboxes = inboxesResponse ?? [];
    }
  } catch (error) {
    console.error("Error loading conversations:", error);
  }

  return (
    <ConversationsClient
      initialConversations={initialConversations}
      initialInboxes={initialInboxes}
    />
  );
}

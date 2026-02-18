import { getAccessToken } from "@/lib/auth0";
import { fetchConversations, fetchInboxes, fetchLabels } from "@/lib/services/messaging-service";
import { ConversationsClient } from "./conversations-client";

export const dynamic = "force-dynamic";

export default async function ConversationsPage() {
  let initialConversations: unknown[] = [];
  let initialInboxes: unknown[] = [];
  let initialLabels: unknown[] = [];

  try {
    const token = await getAccessToken();
    if (token) {
      const [convResponse, inboxesResponse, labelsResponse] = await Promise.allSettled([
        fetchConversations(token, { status: "open" }),
        fetchInboxes(token),
        fetchLabels(token),
      ]);
      initialConversations = convResponse.status === "fulfilled" ? convResponse.value.data ?? [] : [];
      initialInboxes = inboxesResponse.status === "fulfilled" ? inboxesResponse.value ?? [] : [];
      initialLabels = labelsResponse.status === "fulfilled" ? labelsResponse.value.data ?? [] : [];
    }
  } catch (error) {
    console.error("Error loading conversations:", error);
  }

  return (
    <ConversationsClient
      initialConversations={initialConversations}
      initialInboxes={initialInboxes}
      initialLabels={initialLabels}
    />
  );
}

import { getAccessToken } from "@/lib/auth0";
import { fetchConversations, fetchInboxes, fetchLabels } from "@/lib/services/messaging-service";
import { ConversationsClient } from "./conversations-client";

export const dynamic = "force-dynamic";

export default async function ConversationsPage({
  searchParams,
}: {
  searchParams: Promise<{ section?: string }>;
}) {
  const params = await searchParams;
  let initialConversations: unknown[] = [];
  let initialInboxes: unknown[] = [];
  let initialLabels: unknown[] = [];

  try {
    const token = await getAccessToken();
    if (token) {
      const fetchParams: Record<string, string> = { status: "open" };
      if (params.section === "sale") fetchParams.stage = "sale";
      if (params.section === "unattended") fetchParams.conversation_type = "unattended";

      const [convResponse, inboxesResponse, labelsResponse] = await Promise.allSettled([
        fetchConversations(token, fetchParams),
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
      key={params.section ?? "all"}
      initialConversations={initialConversations}
      initialInboxes={initialInboxes}
      initialLabels={initialLabels}
      initialSection={params.section ?? "all"}
    />
  );
}

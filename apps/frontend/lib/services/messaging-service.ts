const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

async function fetchWithAuth<T>(
  endpoint: string,
  accessToken: string,
  params?: Record<string, string | number>
): Promise<T> {
  const queryParams = new URLSearchParams();
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      queryParams.append(key, value.toString());
    });
  }

  const url = `${API_URL}/messaging${endpoint}${queryParams.toString() ? "?" + queryParams.toString() : ""}`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${endpoint}: ${response.status}`);
  }

  return response.json();
}

export async function fetchConversations(
  accessToken: string,
  params?: Record<string, string | number>
) {
  return fetchWithAuth<{ success: boolean; data: unknown[]; meta: unknown }>(
    "/conversations",
    accessToken,
    params as Record<string, string | number>
  );
}

export async function fetchInboxes(accessToken: string) {
  return fetchWithAuth<unknown[]>("/inboxes", accessToken);
}

export async function fetchLabels(accessToken: string) {
  return fetchWithAuth<{ success: boolean; data: unknown[] }>("/labels", accessToken);
}

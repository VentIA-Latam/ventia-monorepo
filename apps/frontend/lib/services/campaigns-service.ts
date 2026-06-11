// Campaigns API client. Espejo de los 12 endpoints proxy del backend FastAPI
// expuestos en /api/v1/messaging/campaigns/*. Spec: 2026-06-04-campaigns-ui-design.md
import type {
  ApiSuccessResponse,
  Campaign,
  CampaignAudienceResult,
  CampaignCsvUploadResult,
  CampaignPreview,
  CampaignRecipient,
  CampaignRetryResult,
  CampaignTemplateParams,
} from "@/lib/types/campaign";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
const CAMPAIGNS_PREFIX = `${API_URL}/messaging/campaigns`;

class CampaignApiError extends Error {
  status: number;
  body?: unknown;
  constructor(message: string, status: number, body?: unknown) {
    super(message);
    this.name = "CampaignApiError";
    this.status = status;
    this.body = body;
  }
}

async function request<T>(
  url: string,
  accessToken: string,
  init: RequestInit = {}
): Promise<T> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    ...(init.headers as Record<string, string> | undefined),
  };
  // Solo seteamos Content-Type si NO es multipart (FormData) y si no se pasó explícito.
  if (!(init.body instanceof FormData) && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(url, { ...init, headers });
  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  const json = text ? safeJson(text) : null;
  if (!response.ok) {
    throw new CampaignApiError(
      extractErrorMessage(json) || `HTTP ${response.status}`,
      response.status,
      json
    );
  }
  return json as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function extractErrorMessage(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  if (typeof b.detail === "string") return b.detail;
  if (typeof b.error === "string") return b.error;
  if (typeof b.message === "string") return b.message;
  return null;
}

// ─── Reads ─────────────────────────────────────────────────────────────────

export async function fetchCampaigns(
  accessToken: string
): Promise<ApiSuccessResponse<Campaign[]>> {
  return request<ApiSuccessResponse<Campaign[]>>(CAMPAIGNS_PREFIX, accessToken);
}

export async function fetchCampaign(
  accessToken: string,
  id: number
): Promise<ApiSuccessResponse<Campaign>> {
  return request<ApiSuccessResponse<Campaign>>(
    `${CAMPAIGNS_PREFIX}/${id}`,
    accessToken
  );
}

export async function fetchCampaignRecipients(
  accessToken: string,
  id: number,
  params: {
    page?: number;
    per_page?: number;
    status?: string;
    search?: string;
  } = {}
): Promise<ApiSuccessResponse<CampaignRecipient[]>> {
  const qs = new URLSearchParams();
  qs.append("page", String(params.page ?? 1));
  qs.append("per_page", String(params.per_page ?? 25));
  if (params.status) qs.append("status", params.status);
  if (params.search) qs.append("search", params.search);
  return request<ApiSuccessResponse<CampaignRecipient[]>>(
    `${CAMPAIGNS_PREFIX}/${id}/recipients?${qs.toString()}`,
    accessToken
  );
}

export async function previewCampaign(
  accessToken: string,
  id: number
): Promise<ApiSuccessResponse<CampaignPreview>> {
  return request<ApiSuccessResponse<CampaignPreview>>(
    `${CAMPAIGNS_PREFIX}/${id}/preview`,
    accessToken
  );
}

// ─── Mutations ─────────────────────────────────────────────────────────────

export interface CreateCampaignPayload {
  title: string;
  inbox_id: number;
  template_params?: CampaignTemplateParams;
  header_media_url?: string;
}

export async function createCampaign(
  accessToken: string,
  payload: CreateCampaignPayload
): Promise<ApiSuccessResponse<Campaign>> {
  return request<ApiSuccessResponse<Campaign>>(CAMPAIGNS_PREFIX, accessToken, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export interface UpdateCampaignPayload {
  title?: string;
  template_params?: CampaignTemplateParams;
  header_media_url?: string | null;
  enabled?: boolean;
}

export async function updateCampaign(
  accessToken: string,
  id: number,
  payload: UpdateCampaignPayload
): Promise<ApiSuccessResponse<Campaign>> {
  return request<ApiSuccessResponse<Campaign>>(
    `${CAMPAIGNS_PREFIX}/${id}`,
    accessToken,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    }
  );
}

export async function deleteCampaign(
  accessToken: string,
  id: number
): Promise<void> {
  await request<void>(`${CAMPAIGNS_PREFIX}/${id}`, accessToken, {
    method: "DELETE",
  });
}

export async function uploadCampaignCsv(
  accessToken: string,
  id: number,
  file: File
): Promise<ApiSuccessResponse<CampaignCsvUploadResult>> {
  const formData = new FormData();
  formData.append("file", file);
  // Multipart: NO seteamos Content-Type (el browser pone boundary).
  return request<ApiSuccessResponse<CampaignCsvUploadResult>>(
    `${CAMPAIGNS_PREFIX}/${id}/audience/csv`,
    accessToken,
    {
      method: "POST",
      body: formData,
    }
  );
}

export async function setLabelsAudience(
  accessToken: string,
  id: number,
  labelIds: number[]
): Promise<ApiSuccessResponse<CampaignAudienceResult>> {
  return request<ApiSuccessResponse<CampaignAudienceResult>>(
    `${CAMPAIGNS_PREFIX}/${id}/audience/labels`,
    accessToken,
    {
      method: "POST",
      body: JSON.stringify({ label_ids: labelIds }),
    }
  );
}

export async function triggerCampaign(
  accessToken: string,
  id: number,
  scheduledAt?: string
): Promise<ApiSuccessResponse<Campaign>> {
  return request<ApiSuccessResponse<Campaign>>(
    `${CAMPAIGNS_PREFIX}/${id}/trigger`,
    accessToken,
    {
      method: "POST",
      body: JSON.stringify(scheduledAt ? { scheduled_at: scheduledAt } : {}),
    }
  );
}

export async function retryFailedCampaign(
  accessToken: string,
  id: number
): Promise<ApiSuccessResponse<CampaignRetryResult>> {
  return request<ApiSuccessResponse<CampaignRetryResult>>(
    `${CAMPAIGNS_PREFIX}/${id}/retry-failed`,
    accessToken,
    {
      method: "POST",
      body: JSON.stringify({}),
    }
  );
}

export async function deleteCampaignRecipient(
  accessToken: string,
  campaignId: number,
  recipientId: number
): Promise<void> {
  await request<void>(
    `${CAMPAIGNS_PREFIX}/${campaignId}/recipients/${recipientId}`,
    accessToken,
    { method: "DELETE" }
  );
}

export { CampaignApiError };

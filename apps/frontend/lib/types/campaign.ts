// Types del Módulo 6: Campañas Masivas
// Mirror manual de los Pydantic schemas del backend (apps/backend/app/schemas/messaging.py).
// Spec: docs/superpowers/specs/2026-06-04-campaigns-ui-design.md

export type CampaignStatus =
  | "draft"
  | "active"
  | "running"
  | "paused"
  | "completed"
  | "failed";

export type RecipientStatus =
  | "pending"
  | "queued"
  | "sent"
  | "delivered"
  | "read"
  | "failed"
  | "omitted";

export type AudienceType = "labels" | "csv";

export type VariableSource = "csv_column" | "contact_attribute";

export interface CampaignVariableMapping {
  source: VariableSource;
  /** Nombre de la columna en el CSV cuando source = csv_column */
  key?: string;
  /** Path dot-separated cuando source = contact_attribute (ej. "name", "custom_attributes.order_id") */
  path?: string;
}

export interface CampaignTemplateParams {
  name: string;
  language: string;
  /** Mapping {{N}} → fuente, indexado por string ("1", "2", ...) */
  variables: Record<string, CampaignVariableMapping>;
}

export interface CampaignStats {
  pending: number;
  queued: number;
  sent: number;
  delivered: number;
  read: number;
  failed: number;
  omitted: number;
}

export interface CampaignInboxSummary {
  id: number;
  name: string;
}

export interface Campaign {
  id: number;
  title: string;
  message?: string | null;
  campaign_type: string;
  campaign_status: CampaignStatus;
  audience_type: AudienceType | null;
  header_media_url: string | null;
  template_params: CampaignTemplateParams | null;
  enabled: boolean;
  scheduled_at: string | null;
  triggered_at: string | null;
  recipients_count: number;
  sent_count: number;
  failed_count: number;
  inbox: CampaignInboxSummary;
  stats?: CampaignStats;
  /** Columnas detectadas del CSV (vacío si audience=labels o sin upload). */
  csv_columns?: string[];
}

export interface CampaignRecipient {
  id: number;
  phone: string;
  contact_id: number | null;
  contact_name: string | null;
  conversation_id: number | null;
  message_id: number | null;
  status: RecipientStatus;
  external_error: string | null;
  sent_at: string | null;
  delivered_at: string | null;
  read_at: string | null;
}

export interface CampaignCsvSkippedRow {
  row: number;
  phone: string | null;
  reason: string;
}

export interface CampaignCsvUploadResult {
  recipients_count: number;
  columns: string[];
  phone_column: string | null;
  skipped_rows: CampaignCsvSkippedRow[];
}

export interface CampaignPreviewSample {
  recipient_id: number;
  phone: string;
  contact_name: string | null;
  rendered_body: string | null;
  header_media: string | null;
  /** Cuando el sample es realmente un omitido */
  omitted?: boolean;
  reason?: string;
  /** Cuando el render falló por template no encontrado o similar */
  error?: string;
}

export interface CampaignPreviewOmittedSample {
  phone: string;
  reason: string;
}

export interface CampaignPreview {
  template_name: string | null;
  recipients_count: number;
  samples: CampaignPreviewSample[];
  omitted_samples: CampaignPreviewOmittedSample[];
}

export interface CampaignRetryResult {
  retrying: number;
}

export interface CampaignAudienceResult {
  recipients_count: number;
}

// Wrappers de response del backend (success/data/meta)
export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  message?: string;
  meta?: PaginationMeta;
}

export interface PaginationMeta {
  current_page: number;
  next_page: number | null;
  prev_page: number | null;
  total_pages: number;
  total_count: number;
}

// Helper para los selects de variables en el wizard
export interface ContactBuiltInAttribute {
  label: string;
  path: string;
}

export const CONTACT_BUILT_IN_ATTRIBUTES: ContactBuiltInAttribute[] = [
  { label: "Nombre", path: "name" },
  { label: "Teléfono", path: "phone_number" },
  { label: "Email", path: "email" },
  { label: "Identificador", path: "identifier" },
];

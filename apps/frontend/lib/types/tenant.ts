// Helper type for e-commerce platforms
export type EcommercePlatform = "shopify" | "woocommerce" | null;

// Shopify configuration (access_token never comes from backend)
export interface ShopifyConfig {
  store_url: string;
  api_version: string;
}

// WooCommerce configuration (consumer_key and consumer_secret never come from backend)
export interface WooCommerceConfig {
  store_url: string;
}

// E-commerce settings for a tenant
export interface EcommerceSettings {
  sync_on_validation: boolean;
  shopify?: ShopifyConfig;
  woocommerce?: WooCommerceConfig;
}

// Overall tenant settings
export interface TenantSettings {
  ecommerce?: EcommerceSettings;
}

// E-commerce settings response from backend (sanitized, no credentials)
export interface EcommerceSettingsResponse {
  platform: EcommercePlatform;
  store_url: string | null;
  sync_on_validation: boolean;
  has_credentials: boolean;
}

export interface Tenant {
  id: number;
  name: string;
  slug: string;
  company_id: string | null;
  shopify_store_url: string | null; // Legacy field - kept for backward compatibility
  efact_ruc: string | null;
  emisor_nombre_comercial: string | null;
  emisor_ubigeo: string | null;
  emisor_departamento: string | null;
  emisor_provincia: string | null;
  emisor_distrito: string | null;
  emisor_direccion: string | null;
  is_platform: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  settings?: TenantSettings; // Legacy field for compatibility
  ecommerce_settings?: EcommerceSettingsResponse; // New field from backend
}

export interface TenantDetail extends Tenant {
  user_count: number;
  order_count: number;
}

export interface TenantListResponse {
  total: number;
  items: Tenant[];
  skip: number;
  limit: number;
}

export interface TenantCreate {
  name: string;                                    // Required
  slug?: string;                                   // Optional, auto-generated
  company_id?: string;                             // Optional

  // E-commerce platform configuration
  ecommerce_platform?: "shopify" | "woocommerce";  // Platform selector
  ecommerce_store_url?: string;                    // Unified store URL

  // Shopify OAuth2 credentials
  shopify_client_id?: string;
  shopify_client_secret?: string;
  shopify_api_version?: string;                    // Default: "2025-10"

  // WooCommerce credentials
  ecommerce_consumer_key?: string;
  ecommerce_consumer_secret?: string;

  // Sync settings
  sync_on_validation?: boolean;                    // Default: true

  // Electronic invoicing
  efact_ruc?: string;                              // Peru RUC (11 digits)
  emisor_nombre_comercial?: string;
  emisor_ubigeo?: string;
  emisor_departamento?: string;
  emisor_provincia?: string;
  emisor_distrito?: string;
  emisor_direccion?: string;
}

export interface TenantUpdate {
  name?: string;
  is_active?: boolean;

  // E-commerce configuration
  ecommerce_platform?: "shopify" | "woocommerce" | null;
  ecommerce_store_url?: string;

  // Shopify OAuth2
  shopify_client_id?: string;
  shopify_client_secret?: string;
  shopify_api_version?: string;

  // WooCommerce
  ecommerce_consumer_key?: string;
  ecommerce_consumer_secret?: string;

  sync_on_validation?: boolean;

  // Electronic invoicing
  efact_ruc?: string;
  emisor_nombre_comercial?: string;
  emisor_ubigeo?: string;
  emisor_departamento?: string;
  emisor_provincia?: string;
  emisor_distrito?: string;
  emisor_direccion?: string;
}

export interface TenantFilters {
  search: string;
  status: string;
  isPlatform: string;
}

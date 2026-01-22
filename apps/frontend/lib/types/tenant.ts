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

export interface Tenant {
  id: number;
  name: string;
  slug: string;
  company_id: string | null;
  shopify_store_url: string | null; // Legacy field - kept for backward compatibility
  is_platform: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  settings?: TenantSettings;
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
  name: string;
  slug?: string;
  company_id?: string;
  shopify_store_url: string;
  shopify_access_token: string;
  shopify_api_version?: string;
}

export interface TenantUpdate {
  name?: string;
  shopify_store_url?: string;
  shopify_access_token?: string;
  shopify_api_version?: string;
  is_active?: boolean;
}

export interface TenantFilters {
  search: string;
  status: string;
  isPlatform: string;
}

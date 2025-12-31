export interface Tenant {
  id: number;
  name: string;
  slug: string;
  company_id: string | null;
  shopify_store_url: string | null;
  is_platform: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
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

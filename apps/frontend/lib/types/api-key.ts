export interface APIKey {
  id: number;
  name: string;
  key_prefix: string;
  role: 'admin' | 'logistica' | 'ventas' | 'viewer';
  tenant_id: number;
  is_active: boolean;
  last_used_at: string | null;
  expires_at: string | null;
  created_by_user_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface APIKeyWithCreator extends APIKey {
  created_by: {
    id: number;
    name: string;
    email: string;
  } | null;
}

export interface APIKeyCreate {
  name: string;
  role: 'admin' | 'logistica' | 'ventas' | 'viewer';
  tenant_id?: number;
  expires_at?: string | null;
}

export interface APIKeyCreateResponse {
  id: number;
  name: string;
  key: string; // Complete API key - only shown once!
  key_prefix: string;
  role: 'admin' | 'logistica' | 'ventas' | 'viewer';
  tenant_id: number;
  expires_at: string | null;
  created_at: string;
}

export interface APIKeyUpdate {
  name?: string;
  is_active?: boolean;
  expires_at?: string | null;
}

export interface APIKeyListResponse {
  total: number;
  items: APIKey[];
  skip: number;
  limit: number;
}

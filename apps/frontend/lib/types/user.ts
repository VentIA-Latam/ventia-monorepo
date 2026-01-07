export interface User {
  id: number;
  name: string;
  email: string;
  role: 'SUPER_ADMIN' | 'ADMIN' | 'LOGISTICA';
  is_active: boolean;
  tenant_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface UserListResponse {
  total: number;
  items: User[];
  skip: number;
  limit: number;
}

export interface UserCreate {
  name: string;
  email: string;
  auth0_user_id: string; // Required: Auth0 user ID from manually created user
  password?: string; // Optional: Auth0 handles password via email invitation
  role: 'SUPER_ADMIN' | 'ADMIN' | 'LOGISTICA';
  tenant_id: number; // Required: All users must belong to a tenant
}

export interface UserUpdate {
  name?: string;
  email?: string;
  password?: string;
  role?: 'SUPER_ADMIN' | 'ADMIN' | 'LOGISTICA';
  is_active?: boolean;
  tenant_id?: number | null;
}

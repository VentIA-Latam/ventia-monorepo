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
  password: string;
  role: 'SUPER_ADMIN' | 'ADMIN' | 'LOGISTICA';
  tenant_id?: number | null;
}

export interface UserUpdate {
  name?: string;
  email?: string;
  password?: string;
  role?: 'SUPER_ADMIN' | 'ADMIN' | 'LOGISTICA';
  is_active?: boolean;
  tenant_id?: number | null;
}

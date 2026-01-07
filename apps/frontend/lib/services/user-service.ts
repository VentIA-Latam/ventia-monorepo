/**
 * User service - API calls to backend
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

export interface User {
  id: number;
  email: string;
  name: string;
  role: 'SUPER_ADMIN' | 'ADMIN' | 'LOGISTICA' | 'VENTAS' | 'VIEWER';
  tenant_id: number;
  is_active: boolean;
  auth0_user_id: string;
  created_at: string;
  updated_at: string;
}

/**
 * Get current authenticated user information
 */
export async function getCurrentUser(accessToken: string): Promise<User> {
  const response = await fetch(`${API_URL}/users/me`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Failed to fetch user' }));
    throw new Error(error.detail || 'Failed to fetch current user');
  }

  return response.json();
}

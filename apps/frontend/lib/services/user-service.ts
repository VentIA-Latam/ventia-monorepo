/**
 * User service - API calls to backend
 */

import { cache } from 'react';
import { UserRole } from '@/lib/constants/roles';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

export interface TenantInfo {
  id: number;
  name: string;
  slug: string;
  timezone: string;
}

export interface User {
  id: number;
  email: string;
  name: string;
  role: UserRole;
  tenant_id: number;
  tenant: TenantInfo;
  is_active: boolean;
  auth0_user_id: string;
  created_at: string;
  updated_at: string;
}

/**
 * Get current authenticated user information.
 * Wrapped in React cache() to deduplicate the fetch when called multiple times
 * within the same request (e.g., layout.tsx + page.tsx).
 */
export const getCurrentUser = cache(async (accessToken: string): Promise<User> => {
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
});

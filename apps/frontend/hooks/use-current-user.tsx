/**
 * Hook to get current authenticated user from backend
 */

'use client';

import { useEffect, useState } from 'react';
import { UserRole } from '@/lib/constants/roles';

export interface User {
  id: number;
  email: string;
  name: string;
  role: UserRole;
  tenant_id: number;
  is_active: boolean;
  auth0_user_id: string;
  created_at: string;
  updated_at: string;
}

interface UseCurrentUserReturn {
  user: User | null;
  role: User['role'] | null;
  tenantId: number | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useCurrentUser(): UseCurrentUserReturn {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchUser = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Call our API route which handles auth0 token
      const response = await fetch('/api/user/me');

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to fetch user' }));
        throw new Error(errorData.error || 'Failed to fetch current user');
      }

      const userData = await response.json();
      setUser(userData);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUser();
  }, []);

  return {
    user,
    role: user?.role || null,
    tenantId: user?.tenant_id || null,
    isLoading,
    error,
    refetch: fetchUser,
  };
}

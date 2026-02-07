/**
 * Hook to get current authenticated user from backend
 * ✅ Refactorizado para usar Client API Layer
 */

'use client';

import { useEffect, useState } from 'react';
import { getCurrentUser } from '@/lib/api-client';
import type { User } from '@/lib/types/user';

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

      // ✅ Usa Client API Layer
      const userData = await getCurrentUser();
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

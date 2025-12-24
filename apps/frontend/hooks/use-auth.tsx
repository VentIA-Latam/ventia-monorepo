/**
 * Custom hook for Auth0 in Client Components
 */

'use client';

import { useUser } from '@auth0/nextjs-auth0/client';

export function useAuth() {
  const { user, error, isLoading } = useUser();

  return {
    user,
    isAuthenticated: !!user,
    isLoading,
    error,
  };
}

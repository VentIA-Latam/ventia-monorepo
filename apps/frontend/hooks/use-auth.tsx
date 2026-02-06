/**
 * Auth Context + Hook for Client Components
 *
 * AuthProvider hace el fetch de /api/users/me UNA sola vez
 * y comparte el resultado a todos los componentes via Context.
 */

'use client';

import { useUser } from '@auth0/nextjs-auth0/client';
import { createContext, useContext, useEffect, useState } from 'react';

type UserRole = 'superadmin' | 'admin' | 'logistica' | null;

interface UserWithRole {
  id: number;
  email: string;
  name: string;
  role: UserRole;
  tenant_id: number | null;
}

interface AuthContextValue {
  user: ReturnType<typeof useUser>['user'];
  userDetails: UserWithRole | null;
  role: UserRole;
  isAuthenticated: boolean;
  isSuperAdmin: boolean;
  isAdmin: boolean;
  isLogistica: boolean;
  isLoading: boolean;
  isUserLoading: boolean;
  error: ReturnType<typeof useUser>['error'];
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { user, error, isLoading } = useUser();
  const [userRole, setUserRole] = useState<UserRole>(null);
  const [userDetails, setUserDetails] = useState<UserWithRole | null>(null);
  const [loadingRole, setLoadingRole] = useState(false);

  useEffect(() => {
    if (user && !loadingRole && !userDetails) {
      fetchUserRole();
    }
  }, [user]);

  const fetchUserRole = async () => {
    try {
      setLoadingRole(true);
      const response = await fetch('/api/users/me');

      if (response.ok) {
        const data = await response.json();
        setUserDetails(data);
        setUserRole(data.role);
      } else {
        console.error('Failed to fetch user role, status:', response.status);
      }
    } catch (error) {
      console.error('Error fetching user role:', error);
    } finally {
      setLoadingRole(false);
    }
  };

  const value: AuthContextValue = {
    user,
    userDetails,
    role: userRole,
    isAuthenticated: !!user,
    isSuperAdmin: userRole?.toLowerCase() === 'superadmin',
    isAdmin: userRole?.toLowerCase() === 'admin',
    isLogistica: userRole?.toLowerCase() === 'logistica',
    isLoading: isLoading || loadingRole,
    isUserLoading: isLoading,
    error,
  };

  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

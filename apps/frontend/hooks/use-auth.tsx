/**
 * Custom hook for Auth0 in Client Components
 */

'use client';

import { useUser } from '@auth0/nextjs-auth0/client';
import { useEffect, useState } from 'react';

type UserRole = 'superadmin' | 'admin' | 'logistica' | null;

interface UserWithRole {
  id: number;
  email: string;
  name: string;
  role: UserRole;
  tenant_id: number | null;
}

export function useAuth() {
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
        console.log('User data from API:', data); // Debug
        console.log('User role:', data.role); // Debug
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

  return {
    user,
    userDetails,
    role: userRole,
    isAuthenticated: !!user,
    isSuperAdmin: userRole?.toLowerCase() === 'superadmin',
    isAdmin: userRole?.toLowerCase() === 'admin',
    isLogistica: userRole?.toLowerCase() === 'logistica',
    isLoading: isLoading || loadingRole,
    error,
  };
}

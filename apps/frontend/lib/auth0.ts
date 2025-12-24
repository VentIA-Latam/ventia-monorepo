/**
 * Auth0 utilities for Next.js App Router
 */

import { getSession } from '@auth0/nextjs-auth0';

/**
 * Get the access token from the current session (Server Component)
 */
export async function getAccessToken(): Promise<string | null> {
  const session = await getSession();
  return session?.accessToken || null;
}

/**
 * Get the current user from session (Server Component)
 */
export async function getCurrentUser() {
  const session = await getSession();
  return session?.user || null;
}

/**
 * Check if user is authenticated (Server Component)
 */
export async function isAuthenticated(): Promise<boolean> {
  const session = await getSession();
  return !!session?.user;
}

/**
 * Auth0 utilities for Next.js App Router
 */
import { Auth0Client } from '@auth0/nextjs-auth0/server';

// Initialize Auth0 client with explicit configuration
export const auth0 = new Auth0Client({
  // These will be read from environment variables automatically
  // but we're being explicit about the audience
  authorizationParameters: {
    audience: process.env.AUTH0_AUDIENCE || 'https://ventia-auth0-api',
    scope: 'openid profile email',
  },
});

/**
 * Get the access token from the current session (Server Component)
 */
export async function getAccessToken(): Promise<string | null> {
  const ak = await auth0.getAccessToken();
  return ak.token || null;
}

/**
 * Get the current user from session (Server Component)
 */
export async function getCurrentUser() {
  const session = await auth0.getSession();
  return session?.user || null;
}

/**
 * Check if user is authenticated (Server Component)
 */
export async function isAuthenticated(): Promise<boolean> {
  const session = await auth0.getSession();
  return !!session?.user;
}

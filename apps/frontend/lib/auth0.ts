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
  // Evita la acumulación de cookies __txn_<state>. Con transacciones paralelas
  // (default en v4.14) cada login no completado deja un cookie de ~476 bytes durante
  // 1h; con prefetch de Next.js sobre rutas protegidas con sesión expirada se apilan
  // hasta disparar 494 REQUEST_HEADER_TOO_LARGE en Vercel. Al deshabilitarlas se usa
  // un único cookie __txn_ que se sobrescribe en cada intento. Ver auth0/nextjs-auth0#2450.
  enableParallelTransactions: false,
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

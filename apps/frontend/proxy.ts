import { auth0 } from "./lib/auth0";

export async function proxy(request: Request) {
  const url = new URL(request.url);

  // Let Auth0 handle its own routes
  if (url.pathname.startsWith('/auth/')) {
    return await auth0.middleware(request);
  }

  // Protect superadmin and dashboard routes — auth only, role checks are in layouts
  if (url.pathname.startsWith('/superadmin') || url.pathname.startsWith('/dashboard')) {
    const session = await auth0.getSession();

    if (!session?.user) {
      const loginUrl = new URL('/auth/login', request.url);
      const returnTo = url.pathname;
      if (returnTo && returnTo.startsWith('/') && !returnTo.startsWith('//')) {
        loginUrl.searchParams.set('returnTo', returnTo);
      }
      return Response.redirect(loginUrl);
    }
  }

  // Continue to the page
  return;
}

export const config = {
  matcher: [
    // Auth0 routes (login, logout, callback, etc.)
    '/auth/:path*',
    // Protected routes - SuperAdmin (requires SUPER_ADMIN role)
    '/superadmin/:path*',
    // Protected routes - Dashboard (requires authentication)
    '/dashboard/:path*',
  ],
};
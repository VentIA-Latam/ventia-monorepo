import { auth0 } from "./lib/auth0";

export async function proxy(request: Request) {
  const url = new URL(request.url);

  // Let Auth0 handle its own routes
  if (url.pathname.startsWith('/auth/')) {
    return await auth0.middleware(request);
  }

  // Protect dashboard routes
  if (url.pathname.startsWith('/dashboard')) {
    const session = await auth0.getSession();

    if (!session?.user) {
      // Redirect to Auth0 login with returnTo parameter
      const loginUrl = new URL('/auth/login', request.url);

      // Security: Only use pathname (internal routes) to prevent open redirect
      // Auth0 also validates against Allowed Callback URLs
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
    // Protected routes - Dashboard (requires authentication)
    '/dashboard/:path*',
  ],
};
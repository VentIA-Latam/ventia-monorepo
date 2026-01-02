import { auth0 } from "./lib/auth0";

export async function proxy(request: Request) {
  const url = new URL(request.url);

  // Let Auth0 handle its own routes
  if (url.pathname.startsWith('/auth/')) {
    return await auth0.middleware(request);
  }

  // Protect superadmin routes (SUPER_ADMIN only)
  if (url.pathname.startsWith('/superadmin')) {
    const session = await auth0.getSession();

    if (!session?.user) {
      // Redirect to Auth0 login with returnTo parameter
      const loginUrl = new URL('/auth/login', request.url);
      const returnTo = url.pathname;
      if (returnTo && returnTo.startsWith('/') && !returnTo.startsWith('//')) {
        loginUrl.searchParams.set('returnTo', returnTo);
      }
      return Response.redirect(loginUrl);
    }

    // Check if user has SUPER_ADMIN role
    try {
      const apiUrl = new URL('/api/users/me', request.url);
      const userResponse = await fetch(apiUrl.toString(), {
        headers: {
          Cookie: request.headers.get('cookie') || '',
        },
      });

      if (userResponse.ok) {
        const userData = await userResponse.json();
        const userRole = userData.role?.toUpperCase();

        // If not SUPER_ADMIN, redirect to dashboard
        if (userRole !== 'SUPER_ADMIN' && userRole !== 'SUPERADMIN') {
          console.log(`Access denied to ${url.pathname} for user with role: ${userRole}`);
          return Response.redirect(new URL('/dashboard', request.url));
        }
      } else {
        // If we can't verify the role, redirect to dashboard for safety
        console.error('Failed to verify user role');
        return Response.redirect(new URL('/dashboard', request.url));
      }
    } catch (error) {
      console.error('Error checking superadmin access:', error);
      return Response.redirect(new URL('/dashboard', request.url));
    }
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
    // Protected routes - SuperAdmin (requires SUPER_ADMIN role)
    '/superadmin/:path*',
    // Protected routes - Dashboard (requires authentication)
    '/dashboard/:path*',
  ],
};
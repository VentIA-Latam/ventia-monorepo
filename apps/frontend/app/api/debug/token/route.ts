import { NextResponse } from 'next/server';
import { auth0 } from '@/lib/auth0';

/**
 * GET /api/debug/token
 *
 * DEVELOPMENT ONLY: Returns the Auth0 access token for the current user
 * Use this to get the token for testing with Postman/Insomnia
 *
 * Usage:
 * 1. Login to the app
 * 2. Visit http://localhost:3000/api/debug/token
 * 3. Copy the "accessToken" value
 * 4. Use it in Postman: Authorization: Bearer <token>
 */
export async function GET() {
  // SECURITY: Only allow in development
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json(
      { error: 'This endpoint is only available in development mode' },
      { status: 404 }
    );
  }

  try {
    // Get the user session
    const session = await auth0.getSession();

    if (!session?.user) {
      return NextResponse.json(
        {
          error: 'Not authenticated',
          message: 'Please login first at /login'
        },
        { status: 401 }
      );
    }

    // Get the access token
    const accessTokenResponse = await auth0.getAccessToken();

    if (!accessTokenResponse?.token) {
      return NextResponse.json(
        { error: 'No access token available' },
        { status: 500 }
      );
    }

    // Decode token to check if it's a valid JWT
    const tokenParts = accessTokenResponse.token.split('.');
    let isValidJWT = false;
    let tokenHeader = null;

    if (tokenParts.length === 3) {
      try {
        tokenHeader = JSON.parse(Buffer.from(tokenParts[0], 'base64').toString());
        isValidJWT = true;
      } catch (e) {
        isValidJWT = false;
      }
    }

    // Return token info
    return NextResponse.json({
      success: true,
      accessToken: accessTokenResponse.token,
      tokenInfo: {
        isValidJWT,
        hasKid: tokenHeader?.kid ? true : false,
        header: tokenHeader,
        warning: !isValidJWT || !tokenHeader?.kid
          ? 'Token is not a valid JWT or missing kid. Check Auth0 API configuration.'
          : null,
      },
      user: {
        email: session.user.email,
        name: session.user.name,
        sub: session.user.sub,
      },
      expiresAt: accessTokenResponse.expiresAt,
      usage: {
        postman: `Authorization: Bearer ${accessTokenResponse.token}`,
        curl: `curl -H "Authorization: Bearer ${accessTokenResponse.token}" http://localhost:8000/api/v1/your-endpoint`,
      },
      note: 'Copy the accessToken value and use it in Postman/Insomnia',
      troubleshooting: !isValidJWT || !tokenHeader?.kid ? {
        issue: 'Token missing kid field or not a valid JWT',
        solution: [
          '1. Go to Auth0 Dashboard → Applications → APIs',
          '2. Create an API with identifier: https://ventia-auth0-api',
          '3. Set Signing Algorithm to RS256',
          '4. Make sure AUTH0_AUDIENCE in .env matches the API identifier',
          '5. Logout and login again to get a new token',
        ]
      } : null,
    }, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

  } catch (error) {
    console.error('Error getting access token:', error);
    return NextResponse.json(
      {
        error: 'Failed to get access token',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

import { NextResponse } from 'next/server';
import { getAccessToken } from '@/lib/auth0';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

/**
 * GET /api/user/me
 *
 * Get current authenticated user information from backend
 * This proxies the request to the backend /users/me endpoint
 */
export async function GET() {
  try {
    // Get access token from Auth0 session (server-side)
    const accessToken = await getAccessToken();

    if (!accessToken) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Call backend /users/me endpoint
    const response = await fetch(`${API_URL}/users/me`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to fetch user' }));
      return NextResponse.json(
        { error: error.detail || 'Failed to fetch user' },
        { status: response.status }
      );
    }

    const user = await response.json();
    return NextResponse.json(user);

  } catch (error) {
    console.error('Error fetching current user:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch user',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

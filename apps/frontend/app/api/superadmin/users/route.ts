import { NextResponse } from 'next/server';
import { getAccessToken } from '@/lib/auth0';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

/**
 * GET /api/superadmin/users
 *
 * List all users from the backend
 * Requires SUPER_ADMIN role
 */
export async function GET(request: Request) {
  try {
    const accessToken = await getAccessToken();
    if (!accessToken) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    // Parse query parameters from the request URL
    const { searchParams } = new URL(request.url);
    const skip = searchParams.get('skip') || '0';
    const limit = searchParams.get('limit') || '100';
    // Call backend /users endpoint
    const response = await fetch(`${API_URL}/users?skip=${skip}&limit=${limit}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to fetch users' }));
      return NextResponse.json({ error: error.detail || 'Failed to fetch users' }, { status: response.status });
    }
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json({ error: 'Failed to fetch users', details: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}

/**
 * POST /api/superadmin/users
 *
 * Create a new user
 * Requires SUPER_ADMIN role
 */
export async function POST(request: Request) {
  try {
    const accessToken = await getAccessToken();
    if (!accessToken) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();

    // Call backend POST /users endpoint
    const response = await fetch(`${API_URL}/users`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to create user' }));
      return NextResponse.json({ error: error.detail || 'Failed to create user' }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data, { status: 201 });

  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json({ error: 'Failed to create user', details: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}

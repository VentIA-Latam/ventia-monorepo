import { NextResponse } from 'next/server';
import { getAccessToken } from '@/lib/auth0';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

/**
 * DELETE /api/superadmin/users/[id]
 *
 * Deactivate (soft delete) a user
 * Requires SUPER_ADMIN role
 */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const userId = Number(id);
    if (isNaN(userId)) {
      return NextResponse.json({ error: 'Invalid user id' }, { status: 400 });
    }
    const accessToken = await getAccessToken();
    if (!accessToken) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    const response = await fetch(`${API_URL}/users/${userId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });
    if (response.status === 204) {
      // No content, return a real empty response
      return new NextResponse(null, { status: 204 });
    }
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json({ error: 'Failed to delete user', details: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const userId = Number(id);
    if (isNaN(userId)) {
      return NextResponse.json({ error: 'Invalid user id' }, { status: 400 });
    }
    const accessToken = await getAccessToken();
    if (!accessToken) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    const response = await fetch(`${API_URL}/users/${userId}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to fetch user' }));
      return NextResponse.json({ error: error.detail || 'Failed to fetch user' }, { status: response.status });
    }
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching user:', error);
    return NextResponse.json({ error: 'Failed to fetch user', details: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}

/**
 * PATCH /api/superadmin/users/[id]
 *
 * Update user information (name, email, role, tenant_id)
 * Requires SUPER_ADMIN role
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const userId = Number(id);
    if (isNaN(userId)) {
      return NextResponse.json({ error: 'Invalid user id' }, { status: 400 });
    }
    const accessToken = await getAccessToken();
    if (!accessToken) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    const body = await req.json();
    const response = await fetch(`${API_URL}/users/${userId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to update user' }));
      return NextResponse.json({ error: error.detail || 'Failed to update user' }, { status: response.status });
    }
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json({ error: 'Failed to update user', details: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}

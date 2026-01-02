import { NextResponse } from 'next/server';
import { getAccessToken } from '@/lib/auth0';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

/**
 * DELETE /api/dashboard/api-keys/[id]
 * Revoke (deactivate) an API key for tenant admin
 */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const apiKeyId = Number(id);
    if (isNaN(apiKeyId)) {
      return NextResponse.json({ error: 'Invalid API key id' }, { status: 400 });
    }

    const accessToken = await getAccessToken();
    if (!accessToken) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const response = await fetch(`${API_URL}/api-keys/${apiKeyId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (response.status === 204) {
      return new NextResponse(null, { status: 204 });
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to revoke API key' }));
      return NextResponse.json({ error: error.detail || 'Failed to revoke API key' }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Error revoking API key:', error);
    return NextResponse.json({ error: 'Failed to revoke API key', details: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}

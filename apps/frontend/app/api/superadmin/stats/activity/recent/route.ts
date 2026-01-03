import { NextResponse } from 'next/server';
import { getAccessToken } from '@/lib/auth0';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

/**
 * GET /api/superadmin/stats/activity/recent
 *
 * Get recent platform activity
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
    const limit = searchParams.get('limit') || '10';

    // Call backend /stats/activity/recent endpoint
    const response = await fetch(`${API_URL}/stats/activity/recent?limit=${limit}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to fetch activity' }));
      return NextResponse.json({ error: error.detail || 'Failed to fetch activity' }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching recent activity:', error);
    return NextResponse.json({
      error: 'Failed to fetch activity',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

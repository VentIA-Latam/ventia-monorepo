import { NextRequest, NextResponse } from 'next/server';
import { getAccessToken } from '@/lib/auth0';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

export async function GET(request: NextRequest) {
  try {
    const accessToken = await getAccessToken();
    if (!accessToken) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const params = new URLSearchParams();
    ['period', 'start_date', 'end_date', 'tenant_id'].forEach((key) => {
      const val = searchParams.get(key);
      if (val) params.append(key, val);
    });

    const response = await fetch(
      `${API_URL}/metrics/activity-by-hour${params.toString() ? '?' + params.toString() : ''}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to fetch activity' }));
      return NextResponse.json(
        { error: error.detail || 'Failed to fetch activity' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching activity by hour:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

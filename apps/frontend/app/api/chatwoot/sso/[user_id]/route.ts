import { NextResponse } from 'next/server';
import { getAccessToken } from '@/lib/auth0';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

/**
 * GET /api/chatwoot/sso/[user_id]
 *
 * Get Chatwoot SSO login URL for a specific user by ID
 */
export async function GET(req: Request, { params }: { params: Promise<{ user_id: string }> }) {
    try {
        const { user_id } = await params;
        if (!user_id) {
            return NextResponse.json({ error: 'user_id es obligatorio' }, { status: 400 });
        }
        const accessToken = await getAccessToken();
        if (!accessToken) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }
        // Call backend endpoint which will call Chatwoot
        const url = `${API_URL}/chatwoot/sso/${user_id}`;
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            cache: 'no-store',
        });
        if (!response.ok) {
            const error = await response.json().catch(() => ({ detail: 'Failed to get SSO URL' }));
            return NextResponse.json({ error: error.detail || 'Failed to get SSO URL' }, { status: response.status });
        }
        const data = await response.json();
        return NextResponse.json(data);
    } catch (error) {
        console.error('Error getting Chatwoot SSO URL:', error);
        return NextResponse.json({ error: 'Failed to get Chatwoot SSO URL', details: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
    }
}

import { NextResponse } from 'next/server';
import { getAccessToken } from '@/lib/auth0';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

/**
 * GET /api/chatwoot/config
 *
 * Get Chatwoot configuration status for current user
 */
export async function GET() {
    try {
        const accessToken = await getAccessToken();

        if (!accessToken) {
            return NextResponse.json(
                { error: 'Not authenticated' },
                { status: 401 }
            );
        }

        // Call backend GET /chatwoot/config endpoint
        const response = await fetch(`${API_URL}/chatwoot/config`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            cache: 'no-store',
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ detail: 'Failed to get Chatwoot config' }));
            return NextResponse.json(
                { error: error.detail || 'Failed to get Chatwoot config' },
                { status: response.status }
            );
        }

        const data = await response.json();
        return NextResponse.json(data);

    } catch (error) {
        console.error('Error getting Chatwoot config:', error);
        return NextResponse.json(
            {
                error: 'Failed to get Chatwoot config',
                details: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
}

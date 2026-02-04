/**
 * Invoices API Route
 * GET /api/invoices
 */

import { NextResponse } from 'next/server';
import { getAccessToken } from '@/lib/auth0';
import { fetchInvoices } from '@/lib/services/invoice-service';

export async function GET(request: Request) {
  try {
    const token = await getAccessToken();
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const skip = searchParams.get('skip');
    const limit = searchParams.get('limit');
    const order_id = searchParams.get('order_id');

    const params: Parameters<typeof fetchInvoices>[1] = {
      ...(skip && { skip: parseInt(skip) }),
      ...(limit && { limit: parseInt(limit) }),
      ...(order_id && { order_id: parseInt(order_id) }),
    };

    const invoices = await fetchInvoices(token, params);
    return NextResponse.json(invoices);

  } catch (error) {
    console.error('Error fetching invoices:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch invoices',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

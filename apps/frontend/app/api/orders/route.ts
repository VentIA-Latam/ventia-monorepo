/**
 * Orders API Route
 * GET /api/orders
 */

import { NextResponse } from 'next/server';
import { getAccessToken } from '@/lib/auth0';
import { fetchOrders } from '@/lib/services/order-service';

export async function GET(request: Request) {
  try {
    const token = await getAccessToken();
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const skip = parseInt(searchParams.get('skip') || '0');
    const limit = parseInt(searchParams.get('limit') || '20');
    const validado = searchParams.get('validado');
    const sortBy = searchParams.get('sortBy');
    const sortOrder = searchParams.get('sortOrder') as 'asc' | 'desc' | undefined;

    const params: Parameters<typeof fetchOrders>[1] = {
      skip,
      limit,
      ...(validado !== null && { validado: validado === 'true' }),
      ...(sortBy && { sortBy }),
      ...(sortOrder && { sortOrder }),
    };

    const orders = await fetchOrders(token, params);
    return NextResponse.json(orders);

  } catch (error) {
    console.error('Error fetching orders:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch orders',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

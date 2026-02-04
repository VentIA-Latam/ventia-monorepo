import { NextRequest, NextResponse } from 'next/server';
import { getAccessToken } from '@/lib/auth0';
import { cancelOrder } from '@/lib/services/order-service';

/**
 * POST /api/orders/[id]/cancel
 *
 * Endpoint para cancelar una orden desde el cliente.
 * Maneja el token de forma segura en el servidor.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const accessToken = await getAccessToken();

    if (!accessToken) {
      return NextResponse.json(
        { error: 'No autenticado' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const orderId = parseInt(id);

    if (isNaN(orderId)) {
      return NextResponse.json(
        { error: 'ID de orden inválido' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const cancelledOrder = await cancelOrder(accessToken, orderId, body);

    return NextResponse.json(cancelledOrder);

  } catch (error) {
    console.error('Error cancelling order:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al cancelar orden' },
      { status: 500 }
    );
  }
}

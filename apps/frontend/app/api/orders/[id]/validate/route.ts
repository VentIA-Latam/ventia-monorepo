import { NextRequest, NextResponse } from 'next/server';
import { getAccessToken } from '@/lib/auth0';
import { validateOrder } from '@/lib/services/order-service';

/**
 * POST /api/orders/[id]/validate
 * 
 * Endpoint para validar una orden desde el cliente.
 * Maneja el token de forma segura en el servidor.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Obtener token de Auth0
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

    // Validar la orden
    const validatedOrder = await validateOrder(accessToken, orderId);

    return NextResponse.json(validatedOrder);

  } catch (error) {
    console.error('Error validating order:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al validar orden' },
      { status: 500 }
    );
  }
}

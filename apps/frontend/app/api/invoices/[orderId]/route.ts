import { NextRequest, NextResponse } from "next/server";
import { getAccessToken } from "@/lib/auth0";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

/**
 * POST /api/invoices/[orderId] - Create invoice for order
 * API Route que actúa como proxy seguro al backend
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await params;

    // 1. Obtener token de Auth0 (servidor)
    const token = await getAccessToken();

    if (!token) {
      return NextResponse.json(
        { detail: "No autorizado" },
        { status: 401 }
      );
    }

    // 2. Leer el body de la request
    const body = await request.json();

    // 3. Hacer request al backend
    const response = await fetch(`${API_URL}/orders/${orderId}/invoice`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error creating invoice:", error);
    return NextResponse.json(
      { detail: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

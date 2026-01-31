import { NextRequest, NextResponse } from "next/server";
import { getAccessToken } from "@/lib/auth0";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

/**
 * GET /api/invoices/pdf/[id] - Download invoice PDF
 * API Route que actúa como proxy seguro al backend
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // 1. Obtener token de Auth0 (servidor)
    const token = await getAccessToken();

    if (!token) {
      return NextResponse.json(
        { detail: "No autorizado" },
        { status: 401 }
      );
    }

    // 2. Hacer request al backend
    const response = await fetch(`${API_URL}/invoices/${id}/pdf`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      // Try to get error details from backend
      const contentType = response.headers.get("content-type");
      if (contentType?.includes("application/json")) {
        const errorData = await response.json();
        return NextResponse.json(errorData, { status: response.status });
      }
      return NextResponse.json(
        { detail: "Error al obtener el PDF" },
        { status: response.status }
      );
    }

    // 3. Return binary response with appropriate headers
    const pdfBuffer = await response.arrayBuffer();
    const contentDisposition = response.headers.get("content-disposition");

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": contentDisposition || `attachment; filename="invoice-${id}.pdf"`,
      },
    });
  } catch (error) {
    console.error("Error downloading PDF:", error);
    return NextResponse.json(
      { detail: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

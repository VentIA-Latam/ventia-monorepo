import { NextRequest, NextResponse } from "next/server";
import { getAccessToken } from "@/lib/auth0";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

/**
 * GET /api/invoices/cdr/[id] - Download invoice CDR
 * API Route que actúa como proxy seguro al backend
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const token = await getAccessToken();

    if (!token) {
      return NextResponse.json(
        { detail: "No autorizado" },
        { status: 401 }
      );
    }

    const response = await fetch(`${API_URL}/invoices/${id}/cdr`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const contentType = response.headers.get("content-type");
      if (contentType?.includes("application/json")) {
        const errorData = await response.json();
        return NextResponse.json(errorData, { status: response.status });
      }
      return NextResponse.json(
        { detail: "Error al obtener el CDR" },
        { status: response.status }
      );
    }

    const cdrBuffer = await response.arrayBuffer();
    const contentDisposition = response.headers.get("content-disposition");

    return new NextResponse(cdrBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": contentDisposition || `attachment; filename="invoice-${id}-CDR.json"`,
      },
    });
  } catch (error) {
    console.error("Error downloading CDR:", error);
    return NextResponse.json(
      { detail: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

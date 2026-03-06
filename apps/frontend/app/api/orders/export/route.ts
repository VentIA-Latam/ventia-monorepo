import { NextRequest, NextResponse } from "next/server";
import { getAccessToken } from "@/lib/auth0";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

/**
 * GET /api/orders/export - Export orders as CSV or Excel
 * Forwards query params to backend
 */
export async function GET(request: NextRequest) {
  try {
    const token = await getAccessToken();

    if (!token) {
      return NextResponse.json(
        { detail: "No autorizado" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);

    const response = await fetch(`${API_URL}/orders/export?${searchParams.toString()}`, {
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
        { detail: "Error al exportar pedidos" },
        { status: response.status }
      );
    }

    const buffer = await response.arrayBuffer();
    const contentDisposition = response.headers.get("content-disposition");
    const contentType = response.headers.get("content-type") || "application/octet-stream";

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": contentDisposition || "attachment; filename=pedidos.csv",
      },
    });
  } catch (error) {
    console.error("Error exporting orders:", error);
    return NextResponse.json(
      { detail: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

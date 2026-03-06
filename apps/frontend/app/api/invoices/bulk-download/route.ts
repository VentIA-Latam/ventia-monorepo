import { NextRequest, NextResponse } from "next/server";
import { getAccessToken } from "@/lib/auth0";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

/**
 * POST /api/invoices/bulk-download - Bulk download invoice files as ZIP
 * Body: { invoice_ids: number[], file_type: "pdf" | "xml" | "cdr" }
 */
export async function POST(request: NextRequest) {
  try {
    const token = await getAccessToken();

    if (!token) {
      return NextResponse.json(
        { detail: "No autorizado" },
        { status: 401 }
      );
    }

    const body = await request.json();

    const response = await fetch(`${API_URL}/invoices/bulk-download`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const contentType = response.headers.get("content-type");
      if (contentType?.includes("application/json")) {
        const errorData = await response.json();
        return NextResponse.json(errorData, { status: response.status });
      }
      return NextResponse.json(
        { detail: "Error en la descarga masiva" },
        { status: response.status }
      );
    }

    const buffer = await response.arrayBuffer();
    const contentDisposition = response.headers.get("content-disposition");

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": contentDisposition || "attachment; filename=comprobantes.zip",
      },
    });
  } catch (error) {
    console.error("Error in bulk download:", error);
    return NextResponse.json(
      { detail: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

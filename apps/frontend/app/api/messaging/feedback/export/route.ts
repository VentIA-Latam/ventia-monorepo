import { NextResponse } from "next/server";
import { getAccessToken } from "@/lib/auth0";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

export async function GET(request: Request) {
  try {
    const accessToken = await getAccessToken();
    if (!accessToken) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const response = await fetch(
      `${API_URL}/messaging/feedback/export?${searchParams.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ detail: "Failed to export feedback" }));
      return NextResponse.json({ error: error.detail }, { status: response.status });
    }

    // NDJSON crudo: lo reenviamos como descarga directa (no es JSON parseable).
    const ndjson = await response.text();
    return new NextResponse(ndjson, {
      status: 200,
      headers: {
        "Content-Type": "application/x-ndjson",
        "Content-Disposition": 'attachment; filename="ai_feedback_dataset.jsonl"',
      },
    });
  } catch (error) {
    console.error("Error exporting feedback:", error);
    return NextResponse.json({ error: "Failed to export feedback" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { getAccessToken } from "@/lib/auth0";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

export async function POST(request: NextRequest) {
  try {
    const accessToken = await getAccessToken();
    if (!accessToken) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json();

    const response = await fetch(`${API_URL}/messaging/whatsapp/manual-connect`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: "Failed to connect WhatsApp" }));
      return NextResponse.json(
        { error: error.detail || error.error || "Failed to connect WhatsApp" },
        { status: response.status }
      );
    }

    return NextResponse.json(await response.json());
  } catch (error) {
    console.error("Error connecting WhatsApp manually:", error);
    return NextResponse.json({ error: "Failed to connect WhatsApp" }, { status: 500 });
  }
}

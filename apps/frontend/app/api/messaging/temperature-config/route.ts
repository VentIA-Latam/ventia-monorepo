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
    const response = await fetch(`${API_URL}/messaging/temperature-config?${searchParams.toString()}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: "Failed to fetch temperature config" }));
      return NextResponse.json({ error: error.detail }, { status: response.status });
    }

    return NextResponse.json(await response.json());
  } catch (error) {
    console.error("Error fetching temperature config:", error);
    return NextResponse.json({ error: "Failed to fetch temperature config" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const accessToken = await getAccessToken();
    if (!accessToken) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const qs = searchParams.toString();
    const body = await request.json();

    const response = await fetch(`${API_URL}/messaging/temperature-config${qs ? `?${qs}` : ""}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: "Failed to update temperature config" }));
      return NextResponse.json({ error: error.detail }, { status: response.status });
    }

    return NextResponse.json(await response.json());
  } catch (error) {
    console.error("Error updating temperature config:", error);
    return NextResponse.json({ error: "Failed to update temperature config" }, { status: 500 });
  }
}

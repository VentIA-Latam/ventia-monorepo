import { NextResponse } from "next/server";
import { getAccessToken } from "@/lib/auth0";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function GET() {
  try {
    const accessToken = await getAccessToken();

    if (!accessToken) {
      return NextResponse.json(
        { error: "No access token available" },
        { status: 401 }
      );
    }

    const response = await fetch(`${API_BASE_URL}/invoice-series`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      return NextResponse.json(
        { detail: error.detail || "Failed to fetch invoice series" },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching invoice series:", error);
    return NextResponse.json(
      { error: "Failed to fetch invoice series" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const accessToken = await getAccessToken();

    if (!accessToken) {
      return NextResponse.json(
        { error: "No access token available" },
        { status: 401 }
      );
    }

    const body = await request.json();

    // Extract query parameters from request
    const { searchParams } = new URL(request.url);
    const tenant_id = searchParams.get('tenant_id');

    // Build backend URL with query parameters
    const backendUrl = new URL(`${API_BASE_URL}/invoice-series`);
    if (tenant_id) {
      backendUrl.searchParams.set('tenant_id', tenant_id);
    }

    const response = await fetch(backendUrl.toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      return NextResponse.json(
        { detail: error.detail || "Failed to create invoice series" },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error creating invoice series:", error);
    return NextResponse.json(
      { error: "Failed to create invoice series" },
      { status: 500 }
    );
  }
}

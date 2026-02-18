import { NextResponse } from "next/server";
import { getAccessToken } from "@/lib/auth0";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const accessToken = await getAccessToken();
    if (!accessToken) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const queryParams = new URLSearchParams();
    const page = searchParams.get("page");
    if (page) queryParams.set("page", page);

    const response = await fetch(
      `${API_URL}/messaging/conversations/${id}/messages${queryParams.toString() ? "?" + queryParams.toString() : ""}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: "Failed to fetch messages" }));
      return NextResponse.json({ error: error.detail }, { status: response.status });
    }

    return NextResponse.json(await response.json());
  } catch (error) {
    console.error("Error fetching messages:", error);
    return NextResponse.json({ error: "Failed to fetch messages" }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const accessToken = await getAccessToken();
    if (!accessToken) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { id } = await params;
    const contentType = request.headers.get("content-type") || "";

    // Multipart: forward file upload to FastAPI /upload endpoint
    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file") as File | null;
      const content = (formData.get("content") as string) || "";

      // Build new FormData for FastAPI
      const upstreamForm = new FormData();
      upstreamForm.append("content", content);
      if (file) {
        upstreamForm.append("file", file);
      }

      const response = await fetch(
        `${API_URL}/messaging/conversations/${id}/messages/upload`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
          body: upstreamForm,
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: "Failed to upload message" }));
        return NextResponse.json({ error: error.detail }, { status: response.status });
      }

      return NextResponse.json(await response.json());
    }

    // JSON: regular text message
    const body = await request.json();

    const response = await fetch(
      `${API_URL}/messaging/conversations/${id}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: "Failed to send message" }));
      return NextResponse.json({ error: error.detail }, { status: response.status });
    }

    return NextResponse.json(await response.json());
  } catch (error) {
    console.error("Error sending message:", error);
    return NextResponse.json({ error: "Failed to send message" }, { status: 500 });
  }
}

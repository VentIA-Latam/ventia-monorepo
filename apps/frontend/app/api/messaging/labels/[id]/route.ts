import { NextResponse } from "next/server";
import { getAccessToken } from "@/lib/auth0";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const accessToken = await getAccessToken();
    if (!accessToken) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { id } = await params;

    const response = await fetch(`${API_URL}/messaging/labels/${id}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: "Failed to delete label" }));
      return NextResponse.json({ error: error.detail }, { status: response.status });
    }

    return NextResponse.json(await response.json());
  } catch (error) {
    console.error("Error deleting label:", error);
    return NextResponse.json({ error: "Failed to delete label" }, { status: 500 });
  }
}

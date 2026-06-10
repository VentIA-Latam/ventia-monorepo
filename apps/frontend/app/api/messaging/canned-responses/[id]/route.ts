/**
 * Canned Responses [id] Route
 * PATCH  /api/messaging/canned-responses/[id] — update a canned response
 * DELETE /api/messaging/canned-responses/[id] — delete a canned response
 * Backend (messaging) enforces role-based access: only admin/superadmin may mutate.
 */

import { NextResponse } from "next/server";
import { getAccessToken } from "@/lib/auth0";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const accessToken = await getAccessToken();
    if (!accessToken) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const qs = searchParams.toString();
    const body = await request.json();

    const response = await fetch(`${API_URL}/messaging/canned-responses/${id}${qs ? `?${qs}` : ""}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: "Failed to update canned response" }));
      return NextResponse.json({ error: error.detail }, { status: response.status });
    }

    return NextResponse.json(await response.json());
  } catch (error) {
    console.error("Error updating canned response:", error);
    return NextResponse.json({ error: "Failed to update canned response" }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const accessToken = await getAccessToken();
    if (!accessToken) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const qs = searchParams.toString();

    const response = await fetch(`${API_URL}/messaging/canned-responses/${id}${qs ? `?${qs}` : ""}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    if (response.status === 204) {
      return new NextResponse(null, { status: 204 });
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: "Failed to delete canned response" }));
      return NextResponse.json({ error: error.detail }, { status: response.status });
    }

    return NextResponse.json(await response.json());
  } catch (error) {
    console.error("Error deleting canned response:", error);
    return NextResponse.json({ error: "Failed to delete canned response" }, { status: 500 });
  }
}

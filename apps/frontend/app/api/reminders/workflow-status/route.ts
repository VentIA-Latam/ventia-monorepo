/**
 * Workflow Status API Route
 * GET/PATCH /api/reminders/workflow-status
 */

import { NextResponse } from "next/server";
import { getAccessToken } from "@/lib/auth0";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

export async function GET() {
  try {
    const token = await getAccessToken();
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const response = await fetch(`${API_URL}/reminders/workflow-status`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const error = await response.text();
      return NextResponse.json({ error }, { status: response.status });
    }

    return NextResponse.json(await response.json());
  } catch (error) {
    console.error("Error fetching workflow status:", error);
    return NextResponse.json(
      { error: "Failed to fetch workflow status" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const token = await getAccessToken();
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const response = await fetch(`${API_URL}/reminders/workflow-status`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      return NextResponse.json({ error }, { status: response.status });
    }

    return NextResponse.json(await response.json());
  } catch (error) {
    console.error("Error updating workflow status:", error);
    return NextResponse.json(
      { error: "Failed to update workflow status" },
      { status: 500 }
    );
  }
}

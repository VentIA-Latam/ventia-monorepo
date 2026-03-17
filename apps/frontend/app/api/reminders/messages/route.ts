/**
 * Reminders API Route
 * GET/PUT /api/reminders/messages
 */

import { NextResponse } from "next/server";
import { getAccessToken } from "@/lib/auth0";
import {
  fetchReminderMessages,
  updateReminderMessages,
} from "@/lib/services/reminder-service";

export async function GET() {
  try {
    const token = await getAccessToken();
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const data = await fetchReminderMessages(token);
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching reminders:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch reminders",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const token = await getAccessToken();
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const data = await updateReminderMessages(token, body.messages);
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error updating reminders:", error);
    return NextResponse.json(
      {
        error: "Failed to update reminders",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

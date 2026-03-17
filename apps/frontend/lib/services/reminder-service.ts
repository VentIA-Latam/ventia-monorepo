/**
 * Reminder Service - Server-side service for temperature reminder messages.
 * Used by Server Components and API routes.
 */

import { ReminderMessagesResponse, ReminderMessageUpdate } from "@/lib/types/reminder";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

/**
 * Fetch reminder messages for the current tenant.
 * GET /reminders/messages
 */
export async function fetchReminderMessages(
  accessToken: string
): Promise<ReminderMessagesResponse> {
  const response = await fetch(`${API_URL}/reminders/messages`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to fetch reminder messages: ${error}`);
  }

  return response.json();
}

/**
 * Update reminder message texts.
 * PUT /reminders/messages
 */
export async function updateReminderMessages(
  accessToken: string,
  messages: ReminderMessageUpdate[]
): Promise<ReminderMessagesResponse> {
  const response = await fetch(`${API_URL}/reminders/messages`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ messages }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to update reminder messages: ${error}`);
  }

  return response.json();
}

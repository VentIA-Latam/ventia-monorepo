/**
 * Reminders API Client - Client-side only.
 * Calls Next.js API routes (not backend directly).
 */

import { apiGet, apiPut } from "./client";
import { ReminderMessagesResponse, ReminderMessageUpdate } from "@/lib/types/reminder";

/**
 * Get reminder messages for the current tenant.
 */
export function getReminders(): Promise<ReminderMessagesResponse> {
  return apiGet<ReminderMessagesResponse>("/api/reminders/messages");
}

/**
 * Update reminder message texts.
 */
export function updateReminders(
  messages: ReminderMessageUpdate[]
): Promise<ReminderMessagesResponse> {
  return apiPut<ReminderMessagesResponse>("/api/reminders/messages", { messages });
}

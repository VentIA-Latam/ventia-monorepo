/**
 * Reminders API Client - Client-side only.
 * Calls Next.js API routes (not backend directly).
 */

import { apiGet, apiPut, apiPatch } from "./client";
import { ReminderMessagesResponse, ReminderMessageUpdate, WorkflowStatusResponse } from "@/lib/types/reminder";

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

/**
 * Toggle workflow active status.
 */
export function toggleWorkflowStatus(
  active: boolean
): Promise<WorkflowStatusResponse> {
  return apiPatch<WorkflowStatusResponse>("/api/reminders/workflow-status", { active });
}

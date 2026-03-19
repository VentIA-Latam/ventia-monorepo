export interface ReminderMessage {
  node_id: string;
  node_name: string;
  temperature: string;
  text: string;
}

export interface ReminderWindow {
  window: number;
  window_label: string;
  messages: ReminderMessage[];
}

export interface ReminderMessagesResponse {
  windows: ReminderWindow[];
  workflow_configured: boolean;
}

export interface ReminderMessageUpdate {
  node_id: string;
  text: string;
}

export interface ReminderMessagesUpdateRequest {
  messages: ReminderMessageUpdate[];
}

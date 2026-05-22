/**
 * Shared utility functions for the messaging/conversations module.
 * Extracted from conversation-item, message-bubble, message-view, contact-info-panel.
 */

import type { Message } from "@/lib/types/messaging";

export type SenderRole = "customer" | "operator" | "ai";

/**
 * Identifica quién envió el mensaje:
 * - "customer": mensaje incoming del cliente (Contact)
 * - "operator": outgoing con sender (operador humano via header X-User-Id)
 * - "ai": outgoing sin sender (n8n llama API solo con tenant header)
 */
export function getSenderRole(message: Message): SenderRole {
  if (message.message_type === "incoming") return "customer";
  return message.sender ? "operator" : "ai";
}

/**
 * Devuelve una clave estable que identifica el sender para agrupar
 * mensajes consecutivos en clusters (estilo iMessage).
 */
export function getSenderKey(message: Message): string {
  const role = getSenderRole(message);
  if (role === "ai") return "ai";
  if (message.sender && "id" in message.sender) {
    return `${role}:${message.sender.id}`;
  }
  return role;
}

export function getInitials(name: string | null | undefined): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function parseTimestamp(value: string | number | null): Date | null {
  if (value == null || value === "") return null;
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isNaN(num) && num > 1_000_000_000 && num < 10_000_000_000) {
    return new Date(num * 1000);
  }
  if (!Number.isNaN(num) && num > 1_000_000_000_000) {
    return new Date(num);
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatTime(dateStr: string | number | null): string {
  const date = parseTimestamp(dateStr);
  if (!date) return "";
  return date.toLocaleTimeString("es-PE", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

const DAY_NAMES = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

export function getDateSeparatorLabel(dateStr: string | number | null): string {
  const date = parseTimestamp(dateStr);
  if (!date) return "";

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const msgDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.floor((today.getTime() - msgDay.getTime()) / 86400000);

  if (diffDays === 0) return "Hoy";
  if (diffDays === 1) return "Ayer";
  if (diffDays < 7) return DAY_NAMES[msgDay.getDay()];

  return date.toLocaleDateString("es-PE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function getWhatsAppTime(dateStr: string | number | null): string {
  const date = parseTimestamp(dateStr);
  if (!date) return "";

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const msgDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (msgDay.getTime() === today.getTime()) {
    return date.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" });
  }
  if (msgDay.getTime() === yesterday.getTime()) {
    return "Ayer";
  }
  return date.toLocaleDateString("es-PE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

import type { Inbox, InboxBrief } from "@/lib/types/messaging";

export type ChannelKind = "whatsapp" | "instagram" | "other";

export function getChannelKind(channelType: string | null | undefined): ChannelKind {
  if (channelType === "Channel::Whatsapp") return "whatsapp";
  if (channelType === "Channel::Instagram") return "instagram";
  return "other";
}

const CHANNEL_NAME_SUFFIX = /\s+(whatsapp|instagram|messenger|facebook|telegram|sms|email)\s*$/i;

/**
 * Display label for an inbox.
 * - Strips a leading "@" (we convey channel via icon, not punctuation).
 * - Strips a trailing channel-name suffix that the messaging backend
 *   often auto-appends to inbox names (e.g. "senelstudio Instagram",
 *   "+51944053366 WhatsApp" → "senelstudio", "+51944053366").
 */
export function getInboxDisplayLabel(inbox: Inbox | InboxBrief | null | undefined): string {
  if (!inbox) return "";
  let name = (inbox.name ?? "").trim();
  if (!name) return "";
  if (name.startsWith("@")) name = name.slice(1);
  name = name.replace(CHANNEL_NAME_SUFFIX, "").trim();
  return name;
}

export function getChannelLabel(channelType: string | null | undefined): string {
  switch (getChannelKind(channelType)) {
    case "whatsapp": return "WhatsApp";
    case "instagram": return "Instagram";
    default: return "Otro";
  }
}

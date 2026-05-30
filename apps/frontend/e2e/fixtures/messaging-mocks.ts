import type {
  Conversation,
  Inbox,
  InstagramChannel,
  Label,
  Message,
  WhatsAppChannel,
} from "@/lib/types/messaging";

/**
 * Factories for typed fixture data. Currently consumed by
 * `instagram-contract.spec.ts` to compare against the real backend payload.
 *
 * Note: full `page.route()` based mocking for /dashboard/channels and
 * /dashboard/conversations does NOT work because both pages are Server
 * Components that fetch data in Node — page.route() only intercepts the
 * browser. Specs that need controlled state are either skipped or adapted
 * to the dev backend seed data.
 */

export function fakeWhatsAppChannel(
  overrides: Partial<WhatsAppChannel> = {}
): WhatsAppChannel {
  return {
    id: 101,
    phone_number: "+51999111111",
    provider: "whatsapp_cloud",
    inbox_id: 1001,
    inbox_name: "+51999111111 WhatsApp",
    templates_count: 3,
    last_template_sync: "2026-05-20T10:00:00Z",
    reauthorization_required: false,
    ...overrides,
  };
}

export function fakeInstagramChannel(
  overrides: Partial<InstagramChannel> = {}
): InstagramChannel {
  return {
    id: 201,
    instagram_id: "17841400000000000",
    username: "senelstudio",
    inbox_id: 2001,
    inbox_name: "senelstudio Instagram",
    reauthorization_required: false,
    ...overrides,
  };
}

export function fakeInbox(overrides: Partial<Inbox> = {}): Inbox {
  return {
    id: 1001,
    name: "+51999111111 WhatsApp",
    channel_type: "Channel::Whatsapp",
    ...overrides,
  };
}

export function fakeLabel(overrides: Partial<Label> = {}): Label {
  return { id: 1, title: "VIP", color: "#1f93ff", system: false, ...overrides };
}

export function fakeConversation(
  overrides: Partial<Conversation> = {}
): Conversation {
  return {
    id: 5001,
    status: "open",
    stage: "pre_sale",
    inbox_id: 1001,
    inbox: { id: 1001, name: "+51999111111 WhatsApp", channel_type: "Channel::Whatsapp" },
    contact: {
      id: 7001,
      name: "Juan Pérez",
      phone_number: "+51988777666",
      identifier: null,
      whatsapp_bsuid: null,
      email: null,
    },
    assignee: null,
    team: null,
    ai_agent_enabled: true,
    can_reply: true,
    temperature: null,
    labels: [],
    messages_count: 1,
    unread_count: 0,
    agent_last_seen_at: null,
    waiting_since: null,
    first_reply_created_at: null,
    last_message_at: "2026-05-29T18:30:00Z",
    last_message: {
      content: "Hola, ¿está disponible?",
      message_type: "incoming",
      attachment_type: null,
      created_at: "2026-05-29T18:30:00Z",
    },
    created_at: "2026-05-29T18:30:00Z",
    ...overrides,
  };
}

export function fakeMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: 90001,
    content: "Mensaje de prueba",
    message_type: "incoming",
    status: "delivered",
    content_attributes: null,
    additional_attributes: null,
    sender: null,
    attachments: [],
    created_at: "2026-05-29T18:30:00Z",
    ...overrides,
  };
}

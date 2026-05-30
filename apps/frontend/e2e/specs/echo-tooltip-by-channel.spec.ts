import { test } from "../fixtures/pages.fixture";

/**
 * Validating the echo tooltip requires a conversation that contains a
 * message with `message_type=outgoing`, `sender=null`, and
 * `content_attributes.external_echo=true`. The dev backend cannot guarantee
 * such a message exists for both WhatsApp and Instagram inboxes, so this
 * spec is skipped. The behavior is covered by the unit-level logic in
 * `lib/utils/messaging.ts` (`getSenderRole`).
 */
test.describe.skip("Tooltip de echo por canal en burbujas @channels", () => {
  test("conversación de WhatsApp: tooltip dice 'Agente (WhatsApp)'", () => {});
  test("conversación de Instagram: tooltip dice 'Agente (Instagram)'", () => {});
});

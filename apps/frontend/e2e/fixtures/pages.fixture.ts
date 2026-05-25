import { test as base } from "@playwright/test";
import { ConversationsPage } from "../pages/conversations.page";
import { MessageViewPage } from "../pages/message-view.page";
import { MessageSearchPage } from "../pages/message-search.page";

interface PageFixtures {
  conversationsPage: ConversationsPage;
  messageViewPage: MessageViewPage;
  messageSearchPage: MessageSearchPage;
}

export const test = base.extend<PageFixtures>({
  conversationsPage: async ({ page }, use) => {
    await use(new ConversationsPage(page));
  },
  messageViewPage: async ({ page }, use) => {
    await use(new MessageViewPage(page));
  },
  messageSearchPage: async ({ page }, use) => {
    await use(new MessageSearchPage(page));
  },
});

export { expect } from "@playwright/test";

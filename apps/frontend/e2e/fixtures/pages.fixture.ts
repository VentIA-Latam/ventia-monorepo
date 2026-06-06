import { test as base } from "@playwright/test";
import { ConversationsPage } from "../pages/conversations.page";
import { MessageViewPage } from "../pages/message-view.page";
import { MessageSearchPage } from "../pages/message-search.page";
import { ChannelsPage } from "../pages/channels.page";
import { InstagramConsentPage } from "../pages/instagram-consent.page";
import { CampaignsPage } from "../pages/campaigns.page";
import { ContactInfoPanelPage } from "../pages/contact-info-panel.page";

interface PageFixtures {
  conversationsPage: ConversationsPage;
  messageViewPage: MessageViewPage;
  messageSearchPage: MessageSearchPage;
  channelsPage: ChannelsPage;
  instagramConsentPage: InstagramConsentPage;
  campaignsPage: CampaignsPage;
  contactInfoPanelPage: ContactInfoPanelPage;
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
  channelsPage: async ({ page }, use) => {
    await use(new ChannelsPage(page));
  },
  instagramConsentPage: async ({ page }, use) => {
    await use(new InstagramConsentPage(page));
  },
  campaignsPage: async ({ page }, use) => {
    await use(new CampaignsPage(page));
  },
  contactInfoPanelPage: async ({ page }, use) => {
    await use(new ContactInfoPanelPage(page));
  },
});

export { expect } from "@playwright/test";

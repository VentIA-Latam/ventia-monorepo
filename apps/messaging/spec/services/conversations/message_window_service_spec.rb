require 'rails_helper'

RSpec.describe Conversations::MessageWindowService do
  let(:account) { create(:account) }
  let(:contact) { create(:contact, account: account) }

  describe '#can_reply?' do
    shared_examples 'a channel with a 24h window' do
      it 'returns false when there are no incoming messages' do
        expect(described_class.new(conversation).can_reply?).to be(false)
      end

      it 'returns true when the last incoming is within the window' do
        conversation.messages.create!(
          account: account,
          inbox: inbox,
          sender: contact,
          message_type: :incoming,
          content: 'hola',
          created_at: 23.hours.ago
        )

        expect(described_class.new(conversation).can_reply?).to be(true)
      end

      it 'returns false when the last incoming is older than the window' do
        conversation.messages.create!(
          account: account,
          inbox: inbox,
          sender: contact,
          message_type: :incoming,
          content: 'hola',
          created_at: 25.hours.ago
        )

        expect(described_class.new(conversation).can_reply?).to be(false)
      end
    end

    context 'when the channel is Instagram' do
      let(:channel) { create(:channel_instagram, account: account) }
      let(:inbox) { create(:inbox, account: account, channel: channel) }
      let(:contact_inbox) { create(:contact_inbox, contact: contact, inbox: inbox) }
      let(:conversation) do
        create(:conversation,
               account: account,
               contact: contact,
               inbox: inbox,
               contact_inbox: contact_inbox)
      end

      it_behaves_like 'a channel with a 24h window'
    end

    context 'when the channel is WhatsApp' do
      let(:channel) { create(:channel_whatsapp, account: account) }
      let(:inbox) { create(:inbox, account: account, channel: channel) }
      let(:contact_inbox) { create(:contact_inbox, contact: contact, inbox: inbox) }
      let(:conversation) do
        create(:conversation,
               account: account,
               contact: contact,
               inbox: inbox,
               contact_inbox: contact_inbox)
      end

      it_behaves_like 'a channel with a 24h window'
    end
  end
end

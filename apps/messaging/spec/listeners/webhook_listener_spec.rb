require 'rails_helper'

RSpec.describe WebhookListener do
  let(:account)       { create(:account, ventia_tenant_id: SecureRandom.random_number(100_000..999_999)) }
  let(:user)          { create(:user, email: "agent-webhook-#{SecureRandom.hex(4)}@test.com", ventia_user_id: SecureRandom.random_number(100_000..999_999)) }
  let(:contact)       { create(:contact, account: account) }
  let(:inbox)         { create(:inbox, account: account) }
  let(:conversation)  { create(:conversation, account: account, contact: contact, inbox: inbox) }
  let!(:webhook)      { create(:webhook, account: account, subscriptions: ['message_created']) }

  let(:listener) { described_class.instance }

  describe '#message_created' do
    # Stub dispatch_webhooks so we can verify it was called with the right args
    # without firing real webhook delivery jobs. The Message model's
    # after_create_commit :broadcast_created callback publishes the event via
    # Wisper, which routes here automatically.
    before { allow(listener).to receive(:dispatch_webhooks) }

    context 'when the message is incoming from a contact' do
      it 'dispatches the message_created event' do
        conversation.messages.create!(
          account: account, inbox: inbox, sender: contact,
          message_type: :incoming, content: 'hola'
        )

        expect(listener).to have_received(:dispatch_webhooks)
          .with(account, 'message_created', kind_of(Hash))
      end
    end

    context 'when the message is outgoing from a human user (dashboard)' do
      it 'dispatches the message_created event' do
        conversation.messages.create!(
          account: account, inbox: inbox, sender: user,
          message_type: :outgoing, content: 'te atiendo yo'
        )

        expect(listener).to have_received(:dispatch_webhooks)
          .with(account, 'message_created', kind_of(Hash))
      end
    end

    context 'when the message is outgoing without sender (AI via API key)' do
      it 'does not dispatch the event (prevents AI self-loop)' do
        conversation.messages.create!(
          account: account, inbox: inbox, sender: nil,
          message_type: :outgoing, content: 'respuesta del AI'
        )

        expect(listener).not_to have_received(:dispatch_webhooks)
          .with(anything, 'message_created', anything)
      end
    end

    context 'when the message is an external echo (agent replied from the WhatsApp Business app)' do
      it 'dispatches the event so n8n keeps the human reply in context' do
        # Echoes arrive via Meta's webhook with sender: nil but flagged as
        # external_echo, mirroring Whatsapp::IncomingMessageService.
        conversation.messages.create!(
          account: account, inbox: inbox, sender: nil,
          message_type: :outgoing, status: :delivered,
          content: 'respuesta del asesor desde el celular',
          content_attributes: { external_echo: true }
        )

        expect(listener).to have_received(:dispatch_webhooks)
          .with(account, 'message_created', kind_of(Hash))
      end
    end

    context 'when the message is private (internal note)' do
      it 'does not dispatch the event' do
        conversation.messages.create!(
          account: account, inbox: inbox, sender: user,
          message_type: :outgoing, content: 'nota interna', private: true
        )

        expect(listener).not_to have_received(:dispatch_webhooks)
          .with(anything, 'message_created', anything)
      end
    end

    context 'when the message is an activity message' do
      it 'does not dispatch the event' do
        conversation.messages.create!(
          account: account, inbox: inbox, sender: nil,
          message_type: :activity, content: 'IA reactivada por Juan'
        )

        expect(listener).not_to have_received(:dispatch_webhooks)
          .with(anything, 'message_created', anything)
      end
    end
  end

  describe '#dispatch_webhooks (private)' do
    let(:event)   { { data: { message: message } } }
    let(:message) do
      conversation.messages.create!(
        account: account, inbox: inbox, sender: contact,
        message_type: :incoming, content: 'hola'
      )
    end

    context 'when the account has no webhooks subscribed to message_created' do
      let!(:webhook) { nil }
      let(:account_without_webhooks) { create(:account, ventia_tenant_id: SecureRandom.random_number(100_000..999_999)) }
      let(:other_inbox)              { create(:inbox, account: account_without_webhooks) }
      let(:other_contact)            { create(:contact, account: account_without_webhooks) }
      let(:other_conversation)       { create(:conversation, account: account_without_webhooks, contact: other_contact, inbox: other_inbox) }

      it 'does not raise' do
        expect do
          other_conversation.messages.create!(
            account: account_without_webhooks, inbox: other_inbox, sender: other_contact,
            message_type: :incoming, content: 'hola'
          )
        end.not_to raise_error
      end
    end

    context 'when webhook.dispatch_event raises StandardError' do
      it 'rescues the error and does not propagate' do
        allow_any_instance_of(Webhook).to receive(:dispatch_event).and_raise(StandardError, 'boom')

        expect do
          conversation.messages.create!(
            account: account, inbox: inbox, sender: contact,
            message_type: :incoming, content: 'hola'
          )
        end.not_to raise_error
      end
    end
  end
end

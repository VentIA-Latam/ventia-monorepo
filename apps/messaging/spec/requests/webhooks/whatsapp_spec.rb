require 'rails_helper'

RSpec.describe 'POST /webhooks/whatsapp/:phone_number', type: :request do
  include ActiveJob::TestHelper

  let(:account) { create(:account) }
  let(:phone_number_id) { '106540352242922' }
  let(:channel) do
    create(:channel_whatsapp, account: account, phone_number: '+15550783881').tap do |c|
      c.update_column(:provider_config, c.provider_config.merge('phone_number_id' => phone_number_id))
    end
  end
  let!(:inbox) { create(:inbox, account: account, channel: channel) }

  before do
    allow($redis).to receive(:exists?).and_return(false)
    allow($redis).to receive(:setex)
  end

  # WBA envelope (the format Meta actually sends to /webhooks/whatsapp/:phone_number).
  # `display_phone_number` and `phone_number_id` must match the channel above.
  def wba_payload(messages:, contacts: [])
    {
      object: 'whatsapp_business_account',
      entry: [{
        id: '102290129340398',
        changes: [{
          field: 'messages',
          value: {
            messaging_product: 'whatsapp',
            metadata: {
              display_phone_number: '15550783881',
              phone_number_id: phone_number_id
            },
            contacts: contacts,
            messages: messages
          }
        }]
      }]
    }
  end

  def post_webhook(payload)
    post "/webhooks/whatsapp/#{CGI.escape(channel.phone_number)}",
         params: payload.to_json,
         headers: { 'Content-Type' => 'application/json' }
  end

  describe 'E2E happy path — incoming text with phone + bsuid' do
    let(:payload) do
      wba_payload(
        contacts: [{ profile: { name: 'Jessica' }, wa_id: '51999111222', user_id: 'PE.E2E1' }],
        messages: [{
          from: '51999111222',
          from_user_id: 'PE.E2E1',
          id: 'wamid.e2e1',
          timestamp: '1750000100',
          type: 'text',
          text: { body: 'Hola E2E' }
        }]
      )
    end

    it 'returns 200 and persists contact, contact_inbox, conversation and message' do
      perform_enqueued_jobs do
        post_webhook(payload)
      end

      expect(response).to have_http_status(:ok)
      contact = Contact.last
      ci      = ContactInbox.last
      conv    = Conversation.last
      msg     = Message.last

      expect(contact.phone_number).to eq('+51999111222')
      expect(contact.name).to eq('Jessica')
      expect(ci.whatsapp_bsuid).to eq('PE.E2E1')
      expect(conv.contact_inbox_id).to eq(ci.id)
      expect(msg.source_id).to eq('wamid.e2e1')
      expect(msg.content).to eq('Hola E2E')
    end
  end

  describe 'E2E Bug A regression — username-only user (no phone in payload)' do
    let(:payload) do
      wba_payload(
        contacts: [{
          profile: { name: 'Sheena Nelson', username: '@realsheenanelson' },
          user_id: 'US.E2ENOPHONE'
        }],
        messages: [{
          from_user_id: 'US.E2ENOPHONE',
          id: 'wamid.e2e2',
          timestamp: '1750000101',
          type: 'text',
          text: { body: 'Username only' }
        }]
      )
    end

    it 'creates contact with NULL phone_number (never "+" or "+US.xxx")' do
      perform_enqueued_jobs do
        post_webhook(payload)
      end

      expect(response).to have_http_status(:ok)
      contact = Contact.last
      expect(contact.phone_number).to be_nil
      expect(Contact.where(phone_number: '+').count).to eq(0)
      expect(Contact.where("phone_number LIKE '+[A-Z]%'").count).to eq(0)
      expect(contact.name).to eq('Sheena Nelson')
      expect(ContactInbox.last.whatsapp_bsuid).to eq('US.E2ENOPHONE')
    end
  end

  describe 'E2E Bug C regression — second webhook delivers bsuid for a legacy contact' do
    let!(:legacy_contact) do
      create(:contact, account: account, name: 'Old User', phone_number: '+51999333444')
    end
    let!(:legacy_ci) do
      create(:contact_inbox, contact: legacy_contact, inbox: inbox,
                             source_id: '51999333444', whatsapp_bsuid: nil)
    end

    let(:payload) do
      wba_payload(
        contacts: [{ profile: { name: 'Old User' }, wa_id: '51999333444', user_id: 'PE.LATEE2E' }],
        messages: [{
          from: '51999333444',
          from_user_id: 'PE.LATEE2E',
          id: 'wamid.e2e3',
          timestamp: '1750000102',
          type: 'text',
          text: { body: 'now bsuid arrived' }
        }]
      )
    end

    it 'enriches the legacy CI without creating a duplicate' do
      expect do
        perform_enqueued_jobs do
          post_webhook(payload)
        end
      end.not_to change { ContactInbox.where(contact: legacy_contact, inbox: inbox).count }

      expect(response).to have_http_status(:ok)
      expect(legacy_ci.reload.whatsapp_bsuid).to eq('PE.LATEE2E')
    end
  end

  describe 'E2E legacy regression — payload without bsuid still works' do
    let(:payload) do
      wba_payload(
        contacts: [{ profile: { name: 'Legacy' }, wa_id: '51999000000' }],
        messages: [{
          from: '51999000000',
          id: 'wamid.e2e4',
          timestamp: '1750000103',
          type: 'text',
          text: { body: 'pre-bsuid era' }
        }]
      )
    end

    it 'persists contact with phone and CI without bsuid' do
      perform_enqueued_jobs do
        post_webhook(payload)
      end

      expect(response).to have_http_status(:ok)
      expect(Contact.last.phone_number).to eq('+51999000000')
      expect(ContactInbox.last.whatsapp_bsuid).to be_nil
    end
  end

  describe 'E2E unprocessable channel — payload for unknown phone' do
    let(:payload) do
      wba_payload(
        messages: [{
          from: '51999111222',
          id: 'wamid.e2e5',
          timestamp: '1750000104',
          type: 'text',
          text: { body: 'orphan' }
        }]
      ).deep_merge(
        entry: [{ changes: [{ value: { metadata: { display_phone_number: '99999999999' } } }] }]
      )
    end

    it 'still returns 200 to Meta and does not persist anything' do
      expect do
        perform_enqueued_jobs do
          post_webhook(payload)
        end
      end.not_to change(Contact, :count)

      expect(response).to have_http_status(:ok)
    end
  end
end

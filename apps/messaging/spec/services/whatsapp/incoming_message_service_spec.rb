require 'rails_helper'

RSpec.describe Whatsapp::IncomingMessageService do
  let(:account) { create(:account) }
  let(:channel) do
    create(:channel_whatsapp, account: account, phone_number: '+5191000001')
  end
  let(:inbox) { create(:inbox, account: account, channel: channel) }

  before do
    # No real Redis in tests; stub the dedup cache.
    allow($redis).to receive(:exists?).and_return(false)
    allow($redis).to receive(:setex)
  end

  # Wrap a message payload in the WBA envelope expected by the service.
  def webhook(messages:, contacts: [])
    {
      'object' => 'whatsapp_business_account',
      'entry'  => [{
        'changes' => [{
          'value' => {
            'messaging_product' => 'whatsapp',
            'metadata'          => {
              'display_phone_number' => '5191000001',
              'phone_number_id'      => channel.provider_config['phone_number_id']
            },
            'contacts' => contacts,
            'messages' => messages
          },
          'field' => 'messages'
        }]
      }]
    }
  end

  describe '#perform — incoming text message scenarios (Bug A regression)' do
    context 'payload with phone + bsuid (default April 2026+)' do
      let(:payload) do
        webhook(
          contacts: [{ 'profile' => { 'name' => 'Jessica' },
                       'wa_id'   => '51999111222',
                       'user_id' => 'PE.BSUID1' }],
          messages: [{
            'from'         => '51999111222',
            'from_user_id' => 'PE.BSUID1',
            'id'           => 'wamid.t1',
            'type'         => 'text',
            'timestamp'    => '1750000000',
            'text'         => { 'body' => 'Hola' }
          }]
        )
      end

      it 'creates contact with phone and CI with bsuid' do
        described_class.new(inbox: inbox, params: payload).perform

        contact = Contact.last
        ci      = ContactInbox.last
        expect(contact.phone_number).to eq('+51999111222')
        expect(contact.name).to eq('Jessica')
        expect(ci.whatsapp_bsuid).to eq('PE.BSUID1')
      end
    end

    context 'payload BSUID-only (user adopted username, no phone — Sheena Nelson case)' do
      let(:payload) do
        webhook(
          contacts: [{ 'profile' => { 'name' => 'Sheena Nelson', 'username' => '@realsheenanelson' },
                       'user_id' => 'US.SHEENA1' }],
          messages: [{
            'from_user_id' => 'US.SHEENA1',
            'id'           => 'wamid.t2',
            'type'         => 'text',
            'timestamp'    => '1750000001',
            'text'         => { 'body' => 'Hey' }
          }]
        )
      end

      it 'creates contact WITHOUT phone_number = "+" (Bug A guarded)' do
        described_class.new(inbox: inbox, params: payload).perform

        contact = Contact.last
        expect(contact.phone_number).to be_nil
        expect(Contact.where(phone_number: '+').count).to eq(0)
      end

      it 'uses profile.name and links CI by bsuid' do
        described_class.new(inbox: inbox, params: payload).perform
        expect(Contact.last.name).to eq('Sheena Nelson')
        expect(ContactInbox.last.whatsapp_bsuid).to eq('US.SHEENA1')
      end
    end

    context 'payload legacy phone-only (regression: pre-BSUID world)' do
      let(:payload) do
        webhook(
          contacts: [{ 'profile' => { 'name' => 'Legacy' }, 'wa_id' => '51999000000' }],
          messages: [{
            'from'      => '51999000000',
            'id'        => 'wamid.t3',
            'type'      => 'text',
            'timestamp' => '1750000002',
            'text'      => { 'body' => 'old world' }
          }]
        )
      end

      it 'creates contact with phone and CI without bsuid' do
        described_class.new(inbox: inbox, params: payload).perform
        expect(Contact.last.phone_number).to eq('+51999000000')
        expect(ContactInbox.last.whatsapp_bsuid).to be_nil
      end
    end

    context 'subsequent webhook delivers bsuid for a legacy phone contact (Bug C regression)' do
      let!(:legacy_contact) do
        create(:contact, account: account, name: 'Old', phone_number: '+51999333444')
      end
      let!(:legacy_ci) do
        create(:contact_inbox, contact: legacy_contact, inbox: inbox,
                               source_id: '51999333444', whatsapp_bsuid: nil)
      end
      let(:payload) do
        webhook(
          contacts: [{ 'profile' => { 'name' => 'Old' },
                       'wa_id'   => '51999333444',
                       'user_id' => 'PE.LATEBSUID' }],
          messages: [{
            'from'         => '51999333444',
            'from_user_id' => 'PE.LATEBSUID',
            'id'           => 'wamid.t4',
            'type'         => 'text',
            'timestamp'    => '1750000003',
            'text'         => { 'body' => 'still me' }
          }]
        )
      end

      it 'enriches the legacy CI instead of creating a duplicate' do
        expect do
          described_class.new(inbox: inbox, params: payload).perform
        end.not_to change { ContactInbox.where(contact: legacy_contact, inbox: inbox).count }

        expect(legacy_ci.reload.whatsapp_bsuid).to eq('PE.LATEBSUID')
      end
    end
  end
end

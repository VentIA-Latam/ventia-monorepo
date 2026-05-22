require 'rails_helper'

RSpec.describe Whatsapp::UnavailableMessageHandler do
  let(:account) { create(:account) }
  let(:channel) do
    create(:channel_whatsapp, account: account, phone_number: '+5191000099')
  end
  let(:inbox) { create(:inbox, account: account, channel: channel) }

  before do
    allow($redis).to receive(:exists?).and_return(false)
    allow($redis).to receive(:setex)
  end

  describe '#perform — 131060 unsupported messages' do
    context 'with BSUID-only (no phone)' do
      let(:message_data) do
        {
          'type'         => 'unsupported',
          'id'           => 'wamid.unsup1',
          'from_user_id' => 'PE.UNSUPPORTED1',
          'timestamp'    => '1750000010',
          'errors'       => [{ 'code' => 131_060, 'title' => 'Unsupported' }]
        }
      end
      let(:contacts_data) do
        [{ 'profile' => { 'name' => 'Carla' }, 'user_id' => 'PE.UNSUPPORTED1' }]
      end

      it 'creates contact (no phone) and CI with bsuid' do
        described_class.new(
          inbox: inbox,
          message_data: message_data,
          contacts_data: contacts_data
        ).perform

        contact = Contact.last
        ci      = ContactInbox.last
        expect(contact.phone_number).to be_nil
        expect(contact.name).to eq('Carla')
        expect(ci.whatsapp_bsuid).to eq('PE.UNSUPPORTED1')
      end

      it 'creates a placeholder message flagged as unavailable' do
        described_class.new(
          inbox: inbox,
          message_data: message_data,
          contacts_data: contacts_data
        ).perform

        msg = Message.last
        expect(msg.source_id).to eq('wamid.unsup1')
        expect(msg.content_attributes['is_unavailable']).to eq(true)
        expect(msg.content_attributes['unavailable_reason']).to eq('131060')
      end
    end

    context 'with phone-only (legacy path)' do
      let(:message_data) do
        {
          'type'      => 'unsupported',
          'id'        => 'wamid.unsup2',
          'from'      => '51999444555',
          'timestamp' => '1750000011',
          'errors'    => [{ 'code' => 131_060, 'title' => 'Unsupported' }]
        }
      end
      let(:contacts_data) do
        [{ 'profile' => { 'name' => 'Bob' }, 'wa_id' => '51999444555' }]
      end

      it 'creates contact with phone and a placeholder message' do
        described_class.new(
          inbox: inbox,
          message_data: message_data,
          contacts_data: contacts_data
        ).perform

        expect(Contact.last.phone_number).to eq('+51999444555')
        expect(Message.last.content_attributes['is_unavailable']).to eq(true)
      end
    end

    context 'dedup — message already processed' do
      let(:message_data) do
        {
          'type'         => 'unsupported',
          'id'           => 'wamid.dup',
          'from_user_id' => 'PE.DUP',
          'timestamp'    => '1750000012',
          'errors'       => [{ 'code' => 131_060 }]
        }
      end

      it 'does nothing when Message already exists with the same source_id' do
        existing_contact = create(:contact, account: account, phone_number: nil)
        existing_ci = create(:contact_inbox, contact: existing_contact, inbox: inbox,
                                             source_id: 'PE.DUP', whatsapp_bsuid: 'PE.DUP')
        existing_conv = create(:conversation, account: account, contact: existing_contact,
                                              inbox: inbox, contact_inbox: existing_ci)
        Message.create!(
          account: account, inbox: inbox, conversation: existing_conv,
          sender: existing_contact, message_type: :incoming, content_type: :text,
          content: '', source_id: 'wamid.dup'
        ).tap { |m| m.skip_send_reply = true }

        expect do
          described_class.new(
            inbox: inbox,
            message_data: message_data,
            contacts_data: []
          ).perform
        end.not_to change(Message, :count)
      end
    end
  end
end

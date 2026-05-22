require 'rails_helper'

RSpec.describe Whatsapp::SendOnWhatsappService do
  let(:account) { create(:account) }
  let(:channel) { create(:channel_whatsapp, account: account) }
  let(:inbox)   { create(:inbox, account: account, channel: channel) }
  let(:contact) { create(:contact, account: account) }

  # Build an outgoing template message without triggering the after_create_commit
  # send_reply job (which would call the real Meta API).
  def build_template_message(source_id:, category:)
    bsuid = source_id.match?(/\A[A-Z]{2}\./) ? source_id : nil
    ci = create(:contact_inbox, contact: contact, inbox: inbox,
                                source_id: source_id, whatsapp_bsuid: bsuid)
    conversation = create(:conversation, account: account, contact: contact,
                                         inbox: inbox, contact_inbox: ci)
    message = Message.new(
      account: account,
      inbox: inbox,
      conversation: conversation,
      sender: contact,
      message_type: :template,
      content_type: :text,
      content: 'hello',
      additional_attributes: {
        'template_params' => {
          'name'              => 'tpl_x',
          'language'          => 'es',
          'namespace'         => 'ns',
          'processed_params'  => {},
          'template_snapshot' => { 'components' => [], 'category' => category }
        }
      }
    )
    message.skip_send_reply = true
    message.save!
    message
  end

  describe '#send_template_message — Bug B (AUTHENTICATION + BSUID)' do
    let(:processor_double) do
      instance_double(Whatsapp::TemplateProcessorService, call: ['tpl_x', 'ns', 'es', []])
    end

    before do
      allow(Whatsapp::TemplateProcessorService).to receive(:new).and_return(processor_double)
    end

    context 'when template is AUTHENTICATION and recipient is BSUID' do
      let(:message) { build_template_message(source_id: 'PE.AUTHBSUID', category: 'AUTHENTICATION') }

      it 'fails the message with 131062 without calling Meta' do
        expect_any_instance_of(Channel::Whatsapp).not_to receive(:send_template)
        described_class.new(message: message).perform

        expect(message.reload.status).to eq('failed')
        expect(message.external_error).to include('131062')
        expect(message.external_error).to include('Authentication templates')
      end
    end

    context 'when template is AUTHENTICATION and recipient is phone' do
      let(:message) { build_template_message(source_id: '51999111222', category: 'AUTHENTICATION') }

      it 'calls send_template normally' do
        expect_any_instance_of(Channel::Whatsapp).to receive(:send_template).and_return('wamid.OK')
        described_class.new(message: message).perform
        expect(message.reload.source_id).to eq('wamid.OK')
      end
    end

    context 'when template is MARKETING and recipient is BSUID' do
      let(:message) { build_template_message(source_id: 'PE.MARKETING', category: 'MARKETING') }

      it 'calls send_template (BSUID allowed for non-AUTH categories)' do
        expect_any_instance_of(Channel::Whatsapp).to receive(:send_template).and_return('wamid.OK')
        described_class.new(message: message).perform

        expect(message.reload.source_id).to eq('wamid.OK')
        expect(message.external_error).to be_nil
      end
    end

    context 'when category is missing from snapshot (legacy data, pre-fix)' do
      let(:message) { build_template_message(source_id: 'PE.LEGACY', category: nil) }

      it 'calls send_template (defense lives downstream in base_service error mapping)' do
        expect_any_instance_of(Channel::Whatsapp).to receive(:send_template).and_return('wamid.OK')
        described_class.new(message: message).perform

        expect(message.reload.source_id).to eq('wamid.OK')
        expect(message.external_error).to be_nil
      end
    end
  end
end

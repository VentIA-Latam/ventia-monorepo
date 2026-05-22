require 'rails_helper'

RSpec.describe Webhooks::WhatsappEventsJob do
  let(:account) { create(:account) }
  let!(:channel) do
    create(:channel_whatsapp, account: account, phone_number: '+5191000001')
  end
  let!(:inbox) { create(:inbox, account: account, channel: channel) }

  def base_envelope(field:, value_extra: {})
    {
      object: 'whatsapp_business_account',
      entry: [{
        changes: [{
          value: {
            messaging_product: 'whatsapp',
            metadata: {
              display_phone_number: '5191000001',
              phone_number_id: channel.provider_config['phone_number_id']
            }
          }.merge(value_extra),
          field: field
        }]
      }]
    }
  end

  describe '#perform — coexistence echo detection' do
    context "when field is 'smb_message_echoes'" do
      let(:params) do
        base_envelope(
          field: 'smb_message_echoes',
          value_extra: {
            message_echoes: [{
              from: '5191000001',
              to: '51999111222',
              id: 'wamid.echo.detect',
              type: 'text',
              timestamp: '1750000400',
              text: { body: 'desde el celu' }
            }]
          }
        )
      end

      it 'invokes IncomingMessageService with outgoing_echo: true' do
        service = instance_double(Whatsapp::IncomingMessageService, perform: nil)
        expect(Whatsapp::IncomingMessageService)
          .to receive(:new)
          .with(inbox: inbox, params: params, outgoing_echo: true)
          .and_return(service)

        described_class.new.perform(params)
      end
    end

    context "when field is 'messages' (regular incoming)" do
      let(:params) do
        base_envelope(
          field: 'messages',
          value_extra: {
            contacts: [{ profile: { name: 'Ana' }, wa_id: '51999111222' }],
            messages: [{
              from: '51999111222',
              id: 'wamid.regular.detect',
              type: 'text',
              timestamp: '1750000500',
              text: { body: 'hola' }
            }]
          }
        )
      end

      it 'invokes IncomingMessageService with outgoing_echo: false' do
        service = instance_double(Whatsapp::IncomingMessageService, perform: nil)
        expect(Whatsapp::IncomingMessageService)
          .to receive(:new)
          .with(inbox: inbox, params: params, outgoing_echo: false)
          .and_return(service)

        described_class.new.perform(params)
      end
    end

    context 'when channel cannot be resolved from payload' do
      let(:params) do
        base_envelope(field: 'smb_message_echoes').tap do |p|
          p[:entry][0][:changes][0][:value][:metadata][:display_phone_number] = '5199999999'
        end
      end

      it 'does not invoke the service' do
        expect(Whatsapp::IncomingMessageService).not_to receive(:new)
        described_class.new.perform(params)
      end
    end
  end
end

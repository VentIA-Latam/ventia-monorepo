require 'rails_helper'

RSpec.describe Whatsapp::Providers::WhatsappCloudService do
  let(:account) { create(:account) }
  let(:channel) { create(:channel_whatsapp, account: account) }
  let(:service) { described_class.new(whatsapp_channel: channel) }

  describe '#build_recipient' do
    it 'maps a phone-like source_id to {to: phone}' do
      expect(service.send(:build_recipient, '51999111222')).to eq(to: '51999111222')
    end

    it 'maps a BSUID (CC.alphanum) to {recipient: bsuid}' do
      expect(service.send(:build_recipient, 'PE.1A2B3C4D')).to eq(recipient: 'PE.1A2B3C4D')
    end

    it 'maps a Parent BSUID (CC.ENT.alphanum) to {recipient: bsuid}' do
      expect(service.send(:build_recipient, 'US.ENT.11815799212886844830')).to eq(recipient: 'US.ENT.11815799212886844830')
    end

    it 'falls back to {to:} for empty input (defensive)' do
      expect(service.send(:build_recipient, nil)).to eq(to: nil)
    end
  end

  describe '#error_message (Bug B mapping for error 131062)' do
    let(:response_131062) do
      double('Response', parsed_response: {
               'error' => { 'code' => 131_062, 'message' => 'Some original Meta wording' }
             })
    end
    let(:response_generic) do
      double('Response', parsed_response: {
               'error' => { 'code' => 131_000, 'message' => 'Some other failure' }
             })
    end
    let(:response_empty) { double('Response', parsed_response: {}) }

    it 'maps code 131062 to a clear BSUID/AUTH message' do
      expect(service.send(:error_message, response_131062))
        .to eq('131062: Authentication templates do not support BSUID recipients')
    end

    it 'formats other errors as "code: message"' do
      expect(service.send(:error_message, response_generic))
        .to eq('131000: Some other failure')
    end

    it 'returns nil when there is no error object' do
      expect(service.send(:error_message, response_empty)).to be_nil
    end
  end
end

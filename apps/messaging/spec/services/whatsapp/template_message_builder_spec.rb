require 'rails_helper'

RSpec.describe Whatsapp::TemplateMessageBuilder do
  let(:account) { create(:account) }
  let(:channel) do
    create(:channel_whatsapp, account: account).tap do |c|
      c.update_column(:message_templates, templates)
    end
  end
  let(:inbox) { create(:inbox, account: account, channel: channel) }
  let(:conversation) { create(:conversation, account: account, inbox: inbox) }

  let(:approved_template) do
    {
      'id' => '111',
      'name' => 'imagen_button',
      'language' => 'es',
      'status' => 'APPROVED',
      'namespace' => 'ns_123',
      'category' => 'MARKETING',
      'components' => [
        { 'type' => 'HEADER', 'format' => 'IMAGE' },
        { 'type' => 'BODY', 'text' => 'Hola {{1}} te enviamos tu pedido {{2}}' },
        {
          'type' => 'BUTTONS',
          'buttons' => [
            { 'type' => 'QUICK_REPLY', 'text' => 'Si' },
            { 'type' => 'QUICK_REPLY', 'text' => 'No' }
          ]
        }
      ]
    }
  end

  let(:templates) { [approved_template] }

  describe '#build' do
    context 'when the template is APPROVED' do
      it 'interpolates the body and snapshots the components' do
        result = described_class.new(
          conversation: conversation,
          name: 'imagen_button',
          language: 'es',
          processed_params: { 'body' => { '1' => 'Tarek', '2' => '#ORD-1' } }
        ).build

        expect(result[:content]).to eq('Hola Tarek te enviamos tu pedido #ORD-1')
        expect(result[:message_type]).to eq(:template)
        expect(result[:additional_attributes]['template_params']).to include(
          'name' => 'imagen_button',
          'language' => 'es',
          'namespace' => 'ns_123'
        )
        expect(result[:additional_attributes]['template_params']['template_snapshot']['components']).to eq(approved_template['components'])
      end

      it 'snapshots the template category for downstream BSUID validation (Bug B)' do
        result = described_class.new(
          conversation: conversation,
          name: 'imagen_button',
          language: 'es',
          processed_params: { 'body' => { '1' => 'Tarek', '2' => '#ORD-1' } }
        ).build

        expect(result[:additional_attributes]['template_params']['template_snapshot']['category']).to eq('MARKETING')
      end
    end

    context 'when the template does not exist' do
      it 'raises TemplateNotFound' do
        expect do
          described_class.new(
            conversation: conversation,
            name: 'no_existe',
            language: 'es'
          ).build
        end.to raise_error(Whatsapp::TemplateMessageBuilder::TemplateNotFound, /no_existe/)
      end
    end

    context 'when the only match is PENDING or REJECTED' do
      let(:templates) do
        [approved_template.merge('status' => 'PENDING')]
      end

      it 'raises TemplateNotFound' do
        expect do
          described_class.new(
            conversation: conversation,
            name: 'imagen_button',
            language: 'es'
          ).build
        end.to raise_error(Whatsapp::TemplateMessageBuilder::TemplateNotFound)
      end
    end

    context 'when the body has no variables' do
      let(:templates) do
        [approved_template.merge('components' => [
          { 'type' => 'BODY', 'text' => 'Hola estatico' }
        ])]
      end

      it 'returns the body text as-is' do
        result = described_class.new(
          conversation: conversation,
          name: 'imagen_button',
          language: 'es'
        ).build

        expect(result[:content]).to eq('Hola estatico')
      end
    end

    context 'when a body variable is missing from processed_params' do
      it 'raises MissingBodyVariables listing the missing placeholders' do
        expect do
          described_class.new(
            conversation: conversation,
            name: 'imagen_button',
            language: 'es',
            processed_params: { 'body' => { '1' => 'Tarek' } }
          ).build
        end.to raise_error(
          Whatsapp::TemplateMessageBuilder::MissingBodyVariables,
          /Missing body variables.*\{\{2\}\}/
        )
      end
    end

    context 'when a body variable is provided but blank' do
      it 'does not raise (Meta will validate at send time)' do
        expect do
          described_class.new(
            conversation: conversation,
            name: 'imagen_button',
            language: 'es',
            processed_params: { 'body' => { '1' => 'Tarek', '2' => '' } }
          ).build
        end.not_to raise_error
      end
    end

    context 'when the inbox channel is not WhatsApp' do
      before do
        allow(conversation.inbox).to receive(:channel).and_return(Object.new)
      end

      it 'raises TemplateNotFound' do
        expect do
          described_class.new(
            conversation: conversation,
            name: 'imagen_button',
            language: 'es'
          ).build
        end.to raise_error(Whatsapp::TemplateMessageBuilder::TemplateNotFound, /not a WhatsApp channel/)
      end
    end
  end
end

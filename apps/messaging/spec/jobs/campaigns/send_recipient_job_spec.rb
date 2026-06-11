require 'rails_helper'

RSpec.describe Campaigns::SendRecipientJob do
  include ActiveJob::TestHelper

  let(:account)  { create(:account) }
  let(:inbox)    { create(:inbox, account: account) }
  let(:campaign) do
    Campaign.create!(
      account: account, inbox: inbox, title: 'T', campaign_status: :running,
      template_params: { 'name' => 'jockey', 'language' => 'es', 'variables' => {} }
    )
  end
  let(:recipient) { campaign.campaign_recipients.create!(phone: '+51900000001', status: :queued) }

  before do
    ActiveJob::Base.queue_adapter = :test
    # Stubs para aislar el job del envío real a Meta
    allow_any_instance_of(Whatsapp::TemplateMessageBuilder).to receive(:build).and_return(
      content: 'Hola', message_type: :template, additional_attributes: {}
    )
    allow_any_instance_of(Whatsapp::SendOnWhatsappService).to receive(:perform)
  end

  describe 'happy path (variables vacías)' do
    it 'crea contact + conversation + message vía EnsureFromPhoneService' do
      expect { described_class.perform_now(recipient.id) }
        .to change { account.contacts.count }.by(1)
        .and change { Conversation.count }.by(1)
        .and change { Message.count }.by(1)
    end

    it 'actualiza recipient con ids + status :sent' do
      described_class.perform_now(recipient.id)
      recipient.reload
      expect(recipient.status).to eq('sent')
      expect(recipient.contact_id).not_to be_nil
      expect(recipient.conversation_id).not_to be_nil
      expect(recipient.message_id).not_to be_nil
      expect(recipient.sent_at).not_to be_nil
    end

    it 'incrementa campaign.sent_count atómicamente' do
      expect { described_class.perform_now(recipient.id) }
        .to change { campaign.reload.sent_count }.by(1)
    end

    it 'marca campaign :completed si era el último' do
      described_class.perform_now(recipient.id)
      expect(campaign.reload.campaign_status).to eq('completed')
    end
  end

  describe 'path omitted (atributo faltante)' do
    before do
      campaign.update!(template_params: {
        'name' => 'imagen_button', 'language' => 'es',
        'variables' => { '1' => { 'source' => 'contact_attribute', 'path' => 'name' } }
      })
      # recipient sin contact y sin vars → resolver devuelve :missing_attr
    end

    it 'marca recipient :omitted con razón' do
      described_class.perform_now(recipient.id)
      recipient.reload
      expect(recipient.status).to eq('omitted')
      expect(recipient.external_error).to include('missing')
    end

    it 'NO crea conversation/message' do
      expect { described_class.perform_now(recipient.id) }
        .not_to change { Conversation.count }
    end

    it 'NO incrementa sent_count' do
      expect { described_class.perform_now(recipient.id) }
        .not_to change { campaign.reload.sent_count }
    end

    it 'invoca CompletionChecker después de omitir' do
      described_class.perform_now(recipient.id)
      expect(campaign.reload.campaign_status).to eq('completed')
    end
  end

  describe 'path failed (template no encontrado)' do
    before do
      allow_any_instance_of(Whatsapp::TemplateMessageBuilder).to receive(:build)
        .and_raise(Whatsapp::TemplateMessageBuilder::TemplateNotFound, "Template 'x' not found")
    end

    it 'marca recipient :failed con external_error' do
      described_class.perform_now(recipient.id)
      recipient.reload
      expect(recipient.status).to eq('failed')
      expect(recipient.external_error).to include('not found')
    end

    it 'incrementa failed_count' do
      expect { described_class.perform_now(recipient.id) }
        .to change { campaign.reload.failed_count }.by(1)
    end

    it 'no raisea — el job no se reintenta' do
      expect { described_class.perform_now(recipient.id) }.not_to raise_error
    end
  end
end

require 'rails_helper'

RSpec.describe Conversations::EnsureFromPhoneService do
  let(:account)        { create(:account) }
  let(:whatsapp_inbox) { create(:inbox, account: account) } # default factory usa channel_whatsapp
  let(:instagram_inbox) do
    create(:inbox, account: account, channel: create(:channel_instagram, account: account))
  end
  let(:template_params) do
    { name: 'promo_junio', language: 'es', processed_params: { 'body' => { '1' => 'Juan' } } }
  end
  let(:built_attrs) do
    {
      content:               'Hola Juan',
      message_type:          :template,
      additional_attributes: { 'template_params' => { 'name' => 'promo_junio' } }
    }
  end

  before do
    allow_any_instance_of(Whatsapp::TemplateMessageBuilder).to receive(:build).and_return(built_attrs)
    # El envío real lo hace el callback after_create_commit :send_reply de Message
    # vía SendReplyJob (async, Sidekiq). En tests no ejecutamos el job real.
    ActiveJob::Base.queue_adapter = :test
  end

  def build_service(overrides = {})
    described_class.new(
      account:         overrides[:account]         || account,
      inbox:           overrides[:inbox]           || whatsapp_inbox,
      phone:           overrides[:phone]           || '+51999888777',
      template_params: overrides.fetch(:template_params, template_params),
      contact_name:    overrides[:contact_name]    || 'Juan Pérez',
      campaign:        overrides[:campaign]
    )
  end

  describe '#perform' do
    context 'cuando el contacto y la conversación no existen' do
      it 'crea contact, contact_inbox, conversation y message' do
        expect { build_service.perform }
          .to change { account.contacts.count }.by(1)
          .and change { ContactInbox.count }.by(1)
          .and change { Conversation.count }.by(1)
          .and change { Message.count }.by(1)
      end

      it 'devuelve contact_created=true y conversation_created=true' do
        result = build_service.perform
        expect(result.contact_created).to be true
        expect(result.conversation_created).to be true
      end

      it 'asigna el contact_name al contacto nuevo y contact_type :lead' do
        result = build_service(contact_name: 'María López').perform
        expect(result.contact.name).to eq('María López')
        expect(result.contact.contact_type).to eq('lead')
      end

      it 'encola SendReplyJob vía callback (no llama SendOnWhatsappService directamente)' do
        # Crítico: este test bloquea el bug de doble envío. El servicio NO debe
        # invocar SendOnWhatsappService directamente — el callback after_create_commit
        # de Message ya hace eso. Hacer ambos dispara dos sends a Meta (doble cobro).
        expect_any_instance_of(Whatsapp::SendOnWhatsappService).not_to receive(:perform)
        expect { build_service.perform }.to have_enqueued_job(SendReplyJob)
      end
    end

    context 'cuando el contacto existe pero no tiene conversación open' do
      let!(:existing_contact) { create(:contact, account: account, phone_number: '+51999888777', name: 'Juan Pérez') }

      it 'reusa el contact y crea una conversation nueva' do
        expect { build_service.perform }
          .to change { account.contacts.count }.by(0)
          .and change { Conversation.count }.by(1)
      end

      it 'devuelve contact_created=false y conversation_created=true' do
        result = build_service.perform
        expect(result.contact_created).to be false
        expect(result.conversation_created).to be true
      end

      it 'no sobreescribe el nombre del contacto existente' do
        result = build_service(contact_name: 'Otro Nombre').perform
        expect(result.contact.name).to eq('Juan Pérez')
      end
    end

    context 'cuando hay conversación open en el mismo inbox' do
      let!(:contact) { create(:contact, account: account, phone_number: '+51999888777') }
      let!(:contact_inbox) do
        create(:contact_inbox, contact: contact, inbox: whatsapp_inbox, source_id: '51999888777')
      end
      let!(:open_conversation) do
        create(:conversation, account: account, inbox: whatsapp_inbox,
                              contact: contact, contact_inbox: contact_inbox, status: :open)
      end

      it 'reusa ambos sin crear conversación nueva' do
        expect { build_service.perform }.not_to change { Conversation.count }
      end

      it 'devuelve conversation_created=false' do
        result = build_service.perform
        expect(result.conversation_created).to be false
        expect(result.conversation.id).to eq(open_conversation.id)
      end

      it 'agrega el message al hilo existente' do
        result = build_service.perform
        expect(result.message.conversation_id).to eq(open_conversation.id)
      end
    end

    context 'cuando solo hay conversación resolved (no open)' do
      let!(:contact) { create(:contact, account: account, phone_number: '+51999888777') }
      let!(:contact_inbox) do
        create(:contact_inbox, contact: contact, inbox: whatsapp_inbox, source_id: '51999888777')
      end
      let!(:resolved_conversation) do
        create(:conversation, account: account, inbox: whatsapp_inbox,
                              contact: contact, contact_inbox: contact_inbox, status: :resolved)
      end

      it 'crea una conversación nueva sin reabrir la resolved' do
        expect { build_service.perform }.to change { Conversation.count }.by(1)
        expect(resolved_conversation.reload.status).to eq('resolved')
      end
    end

    context 'source_id de ContactInbox' do
      let!(:contact) { create(:contact, account: account, phone_number: '+51999888777') }

      context 'cuando hay bsuid existente y flag habilitado' do
        let!(:existing_ci) do
          create(:contact_inbox, :with_bsuid, contact: contact, inbox: whatsapp_inbox,
                                              source_id: 'PE.OLD123', whatsapp_bsuid: 'PE.OLD123')
        end

        before { ENV['WHATSAPP_BSUID_SENDING'] = 'true' }
        after  { ENV.delete('WHATSAPP_BSUID_SENDING') }

        it 'reusa el ContactInbox con bsuid (no crea uno nuevo con phone)' do
          expect { build_service.perform }.not_to change { ContactInbox.count }
        end
      end

      context 'cuando el flag bsuid no está habilitado' do
        let!(:existing_ci) do
          create(:contact_inbox, :with_bsuid, contact: contact, inbox: whatsapp_inbox,
                                              source_id: 'PE.OLD123', whatsapp_bsuid: 'PE.OLD123')
        end

        it 'crea un ContactInbox nuevo usando phone (sin +) como source_id' do
          expect { build_service.perform }.to change { ContactInbox.count }.by(1)
          new_ci = ContactInbox.where(contact: contact, inbox: whatsapp_inbox).order(:id).last
          expect(new_ci.source_id).to eq('51999888777')
        end
      end
    end

    describe 'validaciones de entrada' do
      it 'raisea InvalidPhoneError cuando phone no tiene +' do
        expect { build_service(phone: '999888777').perform }
          .to raise_error(described_class::InvalidPhoneError, /E\.164/)
      end

      it 'raisea InvalidPhoneError cuando phone tiene 0 después de +' do
        expect { build_service(phone: '+0999888777').perform }
          .to raise_error(described_class::InvalidPhoneError)
      end

      it 'raisea InvalidPhoneError cuando phone excede 15 dígitos' do
        expect { build_service(phone: '+5199988877700000000').perform }
          .to raise_error(described_class::InvalidPhoneError)
      end

      it 'normaliza espacios y guiones' do
        result = build_service(phone: ' +51-999 888 777 ').perform
        expect(result.contact.phone_number).to eq('+51999888777')
      end

      it 'encuentra contacto existente aunque el caller mande phone con espacios/guiones' do
        # Contact ya guardado con formato normalizado (lo hace el callback
        # Contact#prepare_contact_attributes); el caller manda phone con whitespace.
        # El normalize_phone! del servicio debe matchear ambos al mismo string.
        existing = create(:contact, account: account, phone_number: '+51999888777', name: 'Juan')

        expect { build_service(phone: ' +51 999-888-777 ').perform }
          .to change { account.contacts.count }.by(0)

        result = build_service(phone: ' +51 999-888-777 ').perform
        expect(result.contact.id).to eq(existing.id)
        expect(result.contact_created).to be false
      end

      it 'raisea InvalidInboxChannelError cuando el inbox es Instagram' do
        expect { build_service(inbox: instagram_inbox).perform }
          .to raise_error(described_class::InvalidInboxChannelError, /WhatsApp/)
      end

      it 'no crea nada cuando phone es inválido' do
        expect {
          begin
            build_service(phone: 'abc').perform
          rescue described_class::InvalidPhoneError
            # expected
          end
        }.not_to change { account.contacts.count }
      end

      it 'no crea nada cuando inbox no es WhatsApp' do
        expect {
          begin
            build_service(inbox: instagram_inbox).perform
          rescue described_class::InvalidInboxChannelError
            # expected
          end
        }.not_to change { account.contacts.count }
      end

      it 'raisea ArgumentError cuando template_params está vacío' do
        expect { build_service(template_params: nil).perform }
          .to raise_error(ArgumentError, /template_params/)
      end
    end

    describe 'errores propagados desde el builder' do
      it 'propaga TemplateNotFound' do
        allow_any_instance_of(Whatsapp::TemplateMessageBuilder).to receive(:build)
          .and_raise(Whatsapp::TemplateMessageBuilder::TemplateNotFound, 'Template "x" not found')

        expect { build_service.perform }
          .to raise_error(Whatsapp::TemplateMessageBuilder::TemplateNotFound)
      end

      it 'propaga MissingBodyVariables' do
        allow_any_instance_of(Whatsapp::TemplateMessageBuilder).to receive(:build)
          .and_raise(Whatsapp::TemplateMessageBuilder::MissingBodyVariables, 'missing 1')

        expect { build_service.perform }
          .to raise_error(Whatsapp::TemplateMessageBuilder::MissingBodyVariables)
      end
    end

    # NOTA: el envío real lo hace SendReplyJob async vía el callback after_create_commit.
    # Si Meta falla, SendOnWhatsappService internamente marca message.status = :failed con
    # external_error (ver whatsapp/send_on_whatsapp_service.rb líneas 13-18). El endpoint
    # ya devolvió 201 al caller con el conversation_id/message_id antes de que el job corra.

    describe 'campaign opcional' do
      # No existe factory para Campaign, se crea inline (account + inbox WhatsApp + title bastan)
      let!(:campaign) { Campaign.create!(account: account, inbox: whatsapp_inbox, title: 'Test') }

      it 'asocia la conversación a la campaign cuando se pasa' do
        result = build_service(campaign: campaign).perform
        expect(result.conversation.campaign_id).to eq(campaign.id)
      end

      it 'no setea campaign cuando no se pasa' do
        result = build_service.perform
        expect(result.conversation.campaign_id).to be_nil
      end
    end
  end
end

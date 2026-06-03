require 'rails_helper'

RSpec.describe NotificationDispatcher do
  include ActiveJob::TestHelper

  let(:account)       { create(:account, ventia_tenant_id: rand(100_000..999_999)) }
  let(:user)          { create(:user, email: "agent-disp-#{SecureRandom.hex(4)}@test.com", ventia_user_id: rand(100_000..999_999)) }
  let(:contact)       { create(:contact, account: account, name: 'Ana Torres') }
  let(:conversation)  { create(:conversation, account: account, contact: contact) }
  let!(:account_user) { AccountUser.create!(account: account, user: user, role: :agent) }

  before do
    ActiveJob::Base.queue_adapter = :test
    allow(OnlineStatusTracker).to receive(:get_available_user_ids).and_return([])
    PushSubscriptionToken.create!(account: account, user: user, token: "fcm-token-#{SecureRandom.hex(4)}")
  end

  def dispatcher(flag_name = :human_support)
    described_class.new(account, conversation, 'Ana Torres', flag_name)
  end

  # AccountUser#after_create_commit ya crea un NotificationSetting (vía
  # NotificationSetting.create_default_for). Por eso usamos find_or_initialize_by
  # para sobrescribir ese registro sin violar la constraint de unicidad
  # (user_id, account_id), en lugar de create! que chocaría.
  def set_flags(push_flags:, email_flags:)
    setting = NotificationSetting.find_or_initialize_by(user: user, account: account)
    setting.push_flags  = push_flags
    setting.email_flags = email_flags
    setting.save!
  end

  describe '#perform — :human_support' do
    context 'push y email habilitados' do
      before { set_flags(push_flags: 7, email_flags: 3) }

      it 'encola SendFcmJob' do
        expect { dispatcher.perform }.to have_enqueued_job(Notifications::SendFcmJob)
      end

      it 'encola NotificationMailer#human_support' do
        expect { dispatcher.perform }.to have_enqueued_mail(NotificationMailer, :human_support)
      end

      it 'encola el push con título, cuerpo y data correctos' do
        dispatcher.perform
        job = enqueued_jobs.find { |j| j[:job] == Notifications::SendFcmJob }
        args = job[:args].first

        expect(args['title']).to eq('Conversación requiere soporte humano')
        expect(args['body']).to eq('Ana Torres: necesita atención humana')
        expect(args['tokens']).to all(be_a(String))
        expect(args['tokens']).not_to be_empty
        expect(args.dig('data', 'conversation_id')).to eq(conversation.id.to_s)
        expect(args.dig('data', 'account_id')).to eq(account.id.to_s)
        expect(args.dig('data', 'click_action')).to include("id=#{conversation.id}")
      end
    end

    context 'solo push habilitado (email_flags: 0)' do
      before { set_flags(push_flags: 7, email_flags: 0) }

      it 'encola SendFcmJob' do
        expect { dispatcher.perform }.to have_enqueued_job(Notifications::SendFcmJob)
      end

      it 'no encola mailer' do
        expect { dispatcher.perform }.not_to have_enqueued_mail(NotificationMailer)
      end
    end

    context 'solo email habilitado (push_flags: 0)' do
      before { set_flags(push_flags: 0, email_flags: 3) }

      it 'encola NotificationMailer#human_support' do
        expect { dispatcher.perform }.to have_enqueued_mail(NotificationMailer, :human_support)
      end

      it 'no encola SendFcmJob' do
        expect { dispatcher.perform }.not_to have_enqueued_job(Notifications::SendFcmJob)
      end
    end

    context 'ambos deshabilitados (flags: 0)' do
      before { set_flags(push_flags: 0, email_flags: 0) }

      it 'no encola SendFcmJob' do
        expect { dispatcher.perform }.not_to have_enqueued_job(Notifications::SendFcmJob)
      end

      it 'no encola mailer' do
        expect { dispatcher.perform }.not_to have_enqueued_mail(NotificationMailer)
      end
    end

    context 'agente online' do
      before do
        set_flags(push_flags: 7, email_flags: 3)
        allow(OnlineStatusTracker).to receive(:get_available_user_ids).and_return([user.id])
      end

      it 'no encola SendFcmJob' do
        expect { dispatcher.perform }.not_to have_enqueued_job(Notifications::SendFcmJob)
      end

      it 'no encola mailer' do
        expect { dispatcher.perform }.not_to have_enqueued_mail(NotificationMailer)
      end
    end

    context 'sin NotificationSetting (allow by default)' do
      before { NotificationSetting.where(user: user, account: account).destroy_all }

      it 'encola SendFcmJob' do
        expect { dispatcher.perform }.to have_enqueued_job(Notifications::SendFcmJob)
      end

      it 'encola NotificationMailer#human_support' do
        expect { dispatcher.perform }.to have_enqueued_mail(NotificationMailer, :human_support)
      end
    end

    context 'email-eligible con dirección malformada en DB' do
      before do
        set_flags(push_flags: 0, email_flags: 3)
        user.update_columns(email: 'no-es-un-email-valido')
      end

      it 'no encola mailer cuando el único email es inválido' do
        expect { dispatcher.perform }.not_to have_enqueued_mail(NotificationMailer)
      end
    end

    context 'push-eligible sin tokens FCM' do
      before do
        set_flags(push_flags: 7, email_flags: 3)
        PushSubscriptionToken.where(account: account, user: user).destroy_all
      end

      it 'no lanza excepción' do
        expect { dispatcher.perform }.not_to raise_error
      end

      it 'sigue enviando email' do
        expect { dispatcher.perform }.to have_enqueued_mail(NotificationMailer, :human_support)
      end
    end

    context 'SUPERADMIN enrolado en la cuenta' do
      let(:superadmin_user) { create(:user, email: "sa-#{SecureRandom.hex(4)}@test.com", ventia_user_id: rand(100_000..999_999)) }
      let!(:superadmin_au)  { AccountUser.create!(account: account, user: superadmin_user, role: :superadmin) }

      before do
        set_flags(push_flags: 7, email_flags: 3)
        PushSubscriptionToken.create!(account: account, user: superadmin_user, token: "fcm-sa-#{SecureRandom.hex(4)}")
      end

      it 'no incluye al SUPERADMIN en push (solo notifica al agente)' do
        dispatcher.perform
        job = enqueued_jobs.find { |j| j[:job] == Notifications::SendFcmJob }
        expect(job[:args].first['tokens']).not_to include(a_string_starting_with('fcm-sa-'))
      end

      it 'no incluye al SUPERADMIN en email' do
        dispatcher.perform
        mail_job = enqueued_jobs.find { |j| j[:job].to_s.include?('MailDeliveryJob') }
        emails_sent = mail_job[:args].last['args'].first['emails']
        expect(emails_sent).not_to include(superadmin_user.email)
      end
    end

    context 'account sin agentes (account_users vacío)' do
      before { AccountUser.where(account: account).destroy_all }

      it 'no encola push ni email' do
        expect { dispatcher.perform }.not_to have_enqueued_job(Notifications::SendFcmJob)
        expect { dispatcher.perform }.not_to have_enqueued_mail(NotificationMailer)
      end
    end

    context 'conversación sin inbox' do
      before do
        set_flags(push_flags: 0, email_flags: 3)
        allow(conversation).to receive(:inbox).and_return(nil)
      end

      it 'encola el mailer aunque no haya channel_name' do
        expect { dispatcher.perform }.to have_enqueued_mail(NotificationMailer, :human_support)
      end
    end

    context 'flag_name no soportado' do
      it 'raises ArgumentError en el constructor (fail fast)' do
        expect {
          described_class.new(account, conversation, 'Ana Torres', :flag_inexistente)
        }.to raise_error(ArgumentError, /flag_name no soportado/)
      end
    end

    context 'cuando dispatch_push lanza una excepción' do
      before do
        set_flags(push_flags: 7, email_flags: 3)
        allow(Notifications::SendFcmJob).to receive(:perform_later).and_raise(RuntimeError, 'boom')
      end

      it 'sigue intentando email (el rescue del canal no detiene el otro)' do
        expect { dispatcher.perform }.to have_enqueued_mail(NotificationMailer, :human_support)
      end

      it 'reporta a Sentry con extras estructurados cuando Sentry está inicializado' do
        stub_const('Sentry', class_double('Sentry'))
        allow(Sentry).to receive(:initialized?).and_return(true)

        expect(Sentry).to receive(:capture_exception).with(
          instance_of(RuntimeError),
          extra: hash_including(
            account_id:      account.id,
            conversation_id: conversation.id,
            flag:            :human_support,
            channel:         'push'
          )
        )

        dispatcher.perform
      end

      it 'no falla si Sentry no está disponible' do
        hide_const('Sentry')
        expect { dispatcher.perform }.not_to raise_error
      end
    end
  end

  describe '#perform — :payment_review' do
    context 'push y email habilitados' do
      before { set_flags(push_flags: 7, email_flags: 3) }

      it 'encola SendFcmJob con título correcto' do
        dispatcher(:payment_review).perform
        job = enqueued_jobs.find { |j| j[:job] == Notifications::SendFcmJob }
        expect(job[:args].first['title']).to eq('Pago pendiente de validar')
      end

      it 'encola NotificationMailer#payment_review' do
        expect { dispatcher(:payment_review).perform }
          .to have_enqueued_mail(NotificationMailer, :payment_review)
      end
    end
  end

  describe '#perform — flags de mensaje (push-only)' do
    let(:inbox)   { create(:inbox, account: account) }
    let(:message) do
      conversation.update!(inbox: inbox)
      conversation.messages.create!(
        account: account, inbox: inbox, sender: contact,
        message_type: :incoming, content: 'Hola, necesito ayuda con mi pedido'
      )
    end

    def dispatcher_for_message(flag)
      described_class.new(account, conversation, 'Ana Torres', flag, message: message)
    end

    context ':message_ai_on con push habilitado' do
      before { set_flags(push_flags: 8, email_flags: 3) }

      it 'encola SendFcmJob con título "Nuevo mensaje" y body desde el contenido' do
        dispatcher_for_message(:message_ai_on).perform
        job = enqueued_jobs.find { |j| j[:job] == Notifications::SendFcmJob }
        expect(job[:args].first['title']).to eq('Nuevo mensaje')
        expect(job[:args].first['body']).to eq('Ana Torres: Hola, necesito ayuda con mi pedido')
      end

      it 'no intenta enviar email aunque email_flags lo permita (flag push-only)' do
        expect { dispatcher_for_message(:message_ai_on).perform }
          .not_to have_enqueued_mail(NotificationMailer)
      end
    end

    context ':message_ai_off con push habilitado (default)' do
      before { set_flags(push_flags: 4, email_flags: 3) }

      it 'encola SendFcmJob' do
        expect { dispatcher_for_message(:message_ai_off).perform }
          .to have_enqueued_job(Notifications::SendFcmJob)
      end

      it 'no intenta enviar email' do
        expect { dispatcher_for_message(:message_ai_off).perform }
          .not_to have_enqueued_mail(NotificationMailer)
      end
    end

    context 'mensaje con contenido muy largo' do
      let(:long_content) { 'a' * 250 }
      let(:long_message) do
        conversation.update!(inbox: inbox)
        conversation.messages.create!(
          account: account, inbox: inbox, sender: contact,
          message_type: :incoming, content: long_content
        )
      end

      before { set_flags(push_flags: 8, email_flags: 0) }

      it 'trunca el body a 100 caracteres' do
        described_class.new(account, conversation, 'Ana Torres', :message_ai_on, message: long_message).perform
        job = enqueued_jobs.find { |j| j[:job] == Notifications::SendFcmJob }
        # 100 chars del content + 3 del ellipsis de truncate(100) = 100
        expect(job[:args].first['body']).to start_with('Ana Torres: ')
        expect(job[:args].first['body'].length).to be <= ('Ana Torres: '.length + 100)
      end
    end

    context 'flag de mensaje sin message:' do
      before { set_flags(push_flags: 8, email_flags: 0) }

      it 'no rompe, manda body vacío después del contact_name' do
        no_msg = described_class.new(account, conversation, 'Ana Torres', :message_ai_on)
        expect { no_msg.perform }.not_to raise_error
        job = enqueued_jobs.find { |j| j[:job] == Notifications::SendFcmJob }
        expect(job[:args].first['body']).to eq('Ana Torres: ')
      end
    end
  end
end

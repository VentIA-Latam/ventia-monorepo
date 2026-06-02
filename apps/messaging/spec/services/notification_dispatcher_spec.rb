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
      before { set_flags(push_flags: 7, email_flags: 3) }

      it 'no encola push ni email' do
        bad = described_class.new(account, conversation, 'Ana Torres', :message_ai_off)
        expect { bad.perform }.not_to have_enqueued_job(Notifications::SendFcmJob)
        expect { bad.perform }.not_to have_enqueued_mail(NotificationMailer)
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
end

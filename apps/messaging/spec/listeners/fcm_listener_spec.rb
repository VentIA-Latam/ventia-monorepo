require 'rails_helper'

RSpec.describe FcmListener do
  include ActiveJob::TestHelper

  let(:account) { create(:account, ventia_tenant_id: SecureRandom.random_number(100_000..999_999)) }
  let(:user) { create(:user, email: "agent-listener-#{SecureRandom.hex(4)}@test.com", ventia_user_id: SecureRandom.random_number(100_000..999_999)) }
  let(:contact) { create(:contact, account: account, name: 'Juan Pérez') }
  let(:conversation) { create(:conversation, account: account, contact: contact) }
  let!(:account_user) { AccountUser.create!(account: account, user: user, role: :agent) }

  let(:listener) { described_class.instance }

  before do
    ActiveJob::Base.queue_adapter = :test
    allow(OnlineStatusTracker).to receive(:get_available_user_ids).and_return([])
  end

  describe '#conversation_labels_updated' do
    context 'when label soporte-humano is added' do
      let(:event) do
        {
          data: {
            conversation: conversation,
            labels: [{ title: 'soporte-humano' }]
          }
        }
      end

      it 'enqueues email delivery for offline agents' do
        expect {
          listener.conversation_labels_updated(event)
        }.to have_enqueued_mail(NotificationMailer, :human_support)
      end

      it 'does not send push notification' do
        expect(Notifications::SendFcmJob).not_to receive(:perform_later)
        listener.conversation_labels_updated(event)
      end

      it 'does not send email to online agents' do
        allow(OnlineStatusTracker).to receive(:get_available_user_ids)
          .and_return([user.id])

        expect {
          listener.conversation_labels_updated(event)
        }.not_to have_enqueued_mail(NotificationMailer, :human_support)
      end

      it 'respects email notification preferences' do
        NotificationSetting.find_or_initialize_by(user: user, account: account).update!(
          email_flags: 0, push_flags: 4
        )

        expect {
          listener.conversation_labels_updated(event)
        }.not_to have_enqueued_mail(NotificationMailer, :human_support)
      end

      it 'sends email when agent has no NotificationSetting (allow by default)' do
        NotificationSetting.where(user: user, account: account).destroy_all

        expect {
          listener.conversation_labels_updated(event)
        }.to have_enqueued_mail(NotificationMailer, :human_support)
      end
    end

    context 'when label en-revisión is added' do
      let(:event) do
        {
          data: {
            conversation: conversation,
            labels: [{ title: 'en-revisión' }]
          }
        }
      end

      it 'enqueues email delivery for offline agents' do
        expect {
          listener.conversation_labels_updated(event)
        }.to have_enqueued_mail(NotificationMailer, :payment_review)
      end

      it 'does not send email to online agents' do
        allow(OnlineStatusTracker).to receive(:get_available_user_ids)
          .and_return([user.id])

        expect {
          listener.conversation_labels_updated(event)
        }.not_to have_enqueued_mail(NotificationMailer, :payment_review)
      end

      it 'respects email notification preferences' do
        NotificationSetting.find_or_initialize_by(user: user, account: account).update!(
          email_flags: 0, push_flags: 4
        )

        expect {
          listener.conversation_labels_updated(event)
        }.not_to have_enqueued_mail(NotificationMailer, :payment_review)
      end
    end

    context 'when an unrelated label is added' do
      let(:event) do
        {
          data: {
            conversation: conversation,
            labels: [{ title: 'venta-cerrada' }]
          }
        }
      end

      it 'does not send any email' do
        expect {
          listener.conversation_labels_updated(event)
        }.not_to have_enqueued_mail(NotificationMailer)
      end
    end
  end
end

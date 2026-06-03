require 'rails_helper'

RSpec.describe FcmListener do
  let(:account)       { create(:account, ventia_tenant_id: SecureRandom.random_number(100_000..999_999)) }
  let(:user)          { create(:user, email: "agent-listener-#{SecureRandom.hex(4)}@test.com", ventia_user_id: SecureRandom.random_number(100_000..999_999)) }
  let(:contact)       { create(:contact, account: account, name: 'Juan Pérez') }
  let(:conversation)  { create(:conversation, account: account, contact: contact) }
  let!(:account_user) { AccountUser.create!(account: account, user: user, role: :agent) }

  let(:listener) { described_class.instance }

  describe '#conversation_labels_updated' do
    context 'when label soporte-humano is added' do
      let(:event) do
        { data: { conversation: conversation, labels: [{ title: 'soporte-humano' }] } }
      end

      it 'delegates to NotificationDispatcher with :human_support' do
        dispatcher_double = instance_double(NotificationDispatcher)
        expect(NotificationDispatcher).to receive(:new)
          .with(account, conversation, 'Juan Pérez', :human_support)
          .and_return(dispatcher_double)
        expect(dispatcher_double).to receive(:perform)

        listener.conversation_labels_updated(event)
      end

      it 'uses "Cliente" as contact_name when contact has no name' do
        allow(conversation.contact).to receive(:name).and_return(nil)

        dispatcher_double = instance_double(NotificationDispatcher)
        expect(NotificationDispatcher).to receive(:new)
          .with(account, conversation, 'Cliente', :human_support)
          .and_return(dispatcher_double)
        allow(dispatcher_double).to receive(:perform)

        listener.conversation_labels_updated(event)
      end
    end

    context 'when label en-revisión is added' do
      let(:event) do
        { data: { conversation: conversation, labels: [{ title: 'en-revisión' }] } }
      end

      it 'delegates to NotificationDispatcher with :payment_review' do
        dispatcher_double = instance_double(NotificationDispatcher)
        expect(NotificationDispatcher).to receive(:new)
          .with(account, conversation, 'Juan Pérez', :payment_review)
          .and_return(dispatcher_double)
        expect(dispatcher_double).to receive(:perform)

        listener.conversation_labels_updated(event)
      end
    end

    context 'when both soporte-humano and en-revisión are added' do
      let(:event) do
        {
          data: {
            conversation: conversation,
            labels: [{ title: 'soporte-humano' }, { title: 'en-revisión' }]
          }
        }
      end

      it 'dispatches both notifications' do
        human_double   = instance_double(NotificationDispatcher)
        payment_double = instance_double(NotificationDispatcher)

        allow(NotificationDispatcher).to receive(:new)
          .with(account, conversation, 'Juan Pérez', :human_support)
          .and_return(human_double)
        allow(NotificationDispatcher).to receive(:new)
          .with(account, conversation, 'Juan Pérez', :payment_review)
          .and_return(payment_double)

        expect(human_double).to receive(:perform)
        expect(payment_double).to receive(:perform)

        listener.conversation_labels_updated(event)
      end
    end

    context 'when an unrelated label is added' do
      let(:event) do
        { data: { conversation: conversation, labels: [{ title: 'venta-cerrada' }] } }
      end

      it 'does not instantiate NotificationDispatcher' do
        expect(NotificationDispatcher).not_to receive(:new)
        listener.conversation_labels_updated(event)
      end
    end

    context 'when NotificationDispatcher raises' do
      let(:event) do
        { data: { conversation: conversation, labels: [{ title: 'soporte-humano' }] } }
      end

      it 'rescues the error and does not propagate it' do
        allow_any_instance_of(NotificationDispatcher).to receive(:perform).and_raise(RuntimeError, 'boom')
        expect { listener.conversation_labels_updated(event) }.not_to raise_error
      end
    end
  end
end

require 'rails_helper'

RSpec.describe ActivityMessageHandler, type: :model do
  let(:account) { create(:account) }
  let(:user) { create(:user, name: 'Juan Pérez') }
  let(:conversation) { create(:conversation, account: account) }

  before { Current.user = user }

  def activity_messages
    conversation.messages.where(message_type: :activity)
  end

  describe '#generate_escalation_activity' do
    it 'creates activity when AI is disabled' do
      conversation.update!(ai_agent_enabled: false)
      expect(activity_messages.last.content).to eq('IA desactivada por Juan Pérez')
    end

    it 'creates activity when AI is re-enabled' do
      conversation.update!(ai_agent_enabled: false)
      conversation.update!(ai_agent_enabled: true)
      expect(activity_messages.last.content).to eq('IA reactivada por Juan Pérez')
    end
  end

  describe '#generate_status_activity' do
    it 'creates activity when status changes to resolved' do
      conversation.update!(status: :resolved)
      expect(activity_messages.last.content).to eq('Conversación resuelta por Juan Pérez')
    end

    it 'creates activity when status changes to pending' do
      conversation.update!(status: :pending)
      expect(activity_messages.last.content).to eq('Conversación pendiente por Juan Pérez')
    end
  end

  describe '#generate_stage_activity' do
    it 'creates activity when stage changes to sale' do
      conversation.update!(stage: :sale)
      expect(activity_messages.last.content).to eq('Etapa cambiada a Venta por Juan Pérez')
    end
  end

  describe '#generate_priority_activity' do
    it 'creates activity when priority changes' do
      conversation.update!(priority: :high)
      expect(activity_messages.last.content).to eq('Prioridad cambiada a Alta por Juan Pérez')
    end
  end

  describe '#generate_temperature_activity' do
    it 'creates activity when temperature changes' do
      # Skip temperature validation for test
      allow_any_instance_of(Conversation).to receive(:validate_temperature_key).and_return(true)
      conversation.update!(temperature: 'calido')
      expect(activity_messages.last.content).to eq("Temperatura 'calido' añadida por Juan Pérez")
    end
  end

  describe '#generate_assignee_activity' do
    let(:agent) { create(:user, name: 'María López') }

    it 'creates activity when assignee is set' do
      conversation.update!(assignee: agent)
      expect(activity_messages.last.content).to eq('Asignado a María López por Juan Pérez')
    end

    it 'creates activity when assignee is removed' do
      conversation.update!(assignee: agent)
      conversation.update!(assignee: nil)
      expect(activity_messages.last.content).to eq('Desasignado por Juan Pérez')
    end
  end

  describe 'Current.user resolution' do
    it "uses 'Sistema' when Current.user is nil" do
      Current.user = nil
      conversation.update!(status: :resolved)
      expect(activity_messages.last.content).to eq('Conversación resuelta por Sistema')
    end

    it 'sets sender to Current.user on activity message' do
      conversation.update!(status: :resolved)
      expect(activity_messages.last.sender).to eq(user)
    end
  end

  describe 'multiple changes' do
    it 'creates multiple activities when multiple fields change' do
      conversation.update!(status: :resolved, priority: :urgent)
      contents = activity_messages.pluck(:content)
      expect(contents).to include('Conversación resuelta por Juan Pérez')
      expect(contents).to include('Prioridad cambiada a Urgente por Juan Pérez')
    end
  end

  describe 'activity messages do not trigger send_reply' do
    it 'sets skip_send_reply on activity messages' do
      expect {
        conversation.update!(status: :resolved)
      }.not_to have_enqueued_job(SendReplyJob)
    end
  end
end

require 'rails_helper'

RSpec.describe ConversationLabel, type: :model do
  let(:account) { create(:account) }
  let(:user) { create(:user, name: 'Juan Pérez') }
  let(:conversation) { create(:conversation, account: account) }
  let(:label) { create(:label, account: account, title: 'vip') }

  before { Current.user = user }

  def activity_messages
    conversation.messages.where(message_type: :activity)
  end

  describe 'label added' do
    it 'creates activity when label is added' do
      conversation.conversation_labels.create!(label: label)
      expect(activity_messages.last.content).to eq("Etiqueta 'vip' añadida por Juan Pérez")
    end

    it "uses 'Sistema' when no current user" do
      Current.user = nil
      conversation.conversation_labels.create!(label: label)
      expect(activity_messages.last.content).to eq("Etiqueta 'vip' añadida por Sistema")
    end
  end

  describe 'label removed' do
    it 'creates activity when label is removed' do
      cl = conversation.conversation_labels.create!(label: label)
      cl.destroy!
      expect(activity_messages.last.content).to eq("Etiqueta 'vip' removida por Juan Pérez")
    end
  end
end

require 'rails_helper'

RSpec.describe Automation::ActionService do
  # Random tenant id to avoid colliding with persisted/seeded accounts (sequence starts low).
  let(:account) { create(:account, ventia_tenant_id: rand(100_000..999_999)) }
  let(:contact) { create(:contact, account: account) }
  let(:conversation) { create(:conversation, account: account, contact: contact, ai_agent_enabled: true) }

  # A CannedResponse responds to .actions, so it can stand in as the `rule:` for the
  # executor — the same path taken when a message originated from a canned response.
  def run(actions)
    rule = account.canned_responses.create!(short_code: "cr-#{rand(100_000)}", content: 'x', actions: actions)
    described_class.new(rule: rule, conversation: conversation).perform
  end

  describe 'set_ai_agent' do
    it 'disables the AI agent and adds the soporte-humano label' do
      run([{ 'action_name' => 'set_ai_agent', 'action_params' => { 'enabled' => false } }])

      conversation.reload
      expect(conversation.ai_agent_enabled).to be false
      expect(conversation.labels.exists?(title: 'soporte-humano')).to be true
    end

    it 're-enables the AI agent and removes the soporte-humano label' do
      conversation.set_ai_agent!(false)
      expect(conversation.labels.exists?(title: 'soporte-humano')).to be true

      run([{ 'action_name' => 'set_ai_agent', 'action_params' => { 'enabled' => true } }])

      conversation.reload
      expect(conversation.ai_agent_enabled).to be true
      expect(conversation.labels.exists?(title: 'soporte-humano')).to be false
    end

    it 'is a no-op when enabled is missing' do
      expect { run([{ 'action_name' => 'set_ai_agent', 'action_params' => {} }]) }.not_to(
        change { conversation.reload.ai_agent_enabled }
      )
    end
  end

  describe 'add_label' do
    it 'applies the given account labels to the conversation' do
      label = create(:label, account: account)

      run([{ 'action_name' => 'add_label', 'action_params' => { 'labels' => [label.id] } }])

      expect(conversation.reload.labels).to include(label)
    end
  end

  describe 'change_status' do
    it 'updates the conversation status' do
      run([{ 'action_name' => 'change_status', 'action_params' => { 'status' => 'resolved' } }])

      expect(conversation.reload.status).to eq('resolved')
    end
  end

  describe 'error isolation' do
    it 'does not raise when an action fails (rescued + logged)' do
      # A label id from another account is silently skipped by add_label; the point is
      # that perform never raises, so a bad action cannot break message sending.
      expect { run([{ 'action_name' => 'add_label', 'action_params' => { 'labels' => [999_999] } }]) }
        .not_to raise_error
    end
  end
end

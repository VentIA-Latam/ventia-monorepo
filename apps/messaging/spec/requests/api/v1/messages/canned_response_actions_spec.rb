require 'rails_helper'

# El frontend envía canned_response_id dentro de content_attributes al enviar un mensaje
# originado en una respuesta rápida; MessagesController#create ejecuta sus acciones.
RSpec.describe 'POST /api/v1/conversations/:id/messages (canned response actions)', type: :request do
  let(:account) { create(:account, ventia_tenant_id: rand(100_000..999_999)) }
  # Build the contact with our (random-tenant) account so the conversation factory does
  # not auto-create a second account with a sequential tenant_id (collides in request specs).
  let(:contact) { create(:contact, account: account) }
  let(:conversation) { create(:conversation, account: account, contact: contact, ai_agent_enabled: true) }
  let(:label) { create(:label, account: account) }
  let(:api_key) { 'test-api-key' }

  let(:headers) do
    {
      'X-Tenant-Id' => account.ventia_tenant_id.to_s,
      'X-API-Key' => api_key,
      'Content-Type' => 'application/json'
    }
  end

  before { ENV['MESSAGING_SERVICE_API_KEY'] = api_key }
  after { ENV.delete('MESSAGING_SERVICE_API_KEY') }

  def send_message(content_attributes:)
    post "/api/v1/conversations/#{conversation.id}/messages",
         params: { message: { content: 'Hola', content_attributes: content_attributes } }.to_json,
         headers: headers
  end

  context 'when the message is armed with a canned response that has actions' do
    let!(:canned_response) do
      account.canned_responses.create!(
        short_code: 'escala', content: 'Te paso con un humano',
        actions: [
          { 'action_name' => 'add_label', 'action_params' => { 'labels' => [label.id] } },
          { 'action_name' => 'set_ai_agent', 'action_params' => { 'enabled' => false } }
        ]
      )
    end

    it 'runs the actions on send' do
      send_message(content_attributes: { canned_response_id: canned_response.id })

      expect(response).to have_http_status(:created)
      conversation.reload
      expect(conversation.labels).to include(label)
      expect(conversation.ai_agent_enabled).to be false
    end

    it 'persists the canned_response_id on the message for audit' do
      send_message(content_attributes: { canned_response_id: canned_response.id })

      # Filter to the outgoing message: the actions add labels, which create activity
      # messages afterwards, so messages.last would be an activity entry.
      outgoing = conversation.messages.outgoing.last
      expect(outgoing.content_attributes['canned_response_id']).to eq(canned_response.id)
    end
  end

  context 'guards' do
    it 'does nothing when no canned_response_id is sent' do
      expect { send_message(content_attributes: { in_reply_to: 'abc' }) }
        .not_to(change { conversation.reload.ai_agent_enabled })
      expect(conversation.labels).to be_empty
    end

    it 'ignores a canned response from another account (anti-IDOR)' do
      other = create(:account, ventia_tenant_id: rand(100_000..999_999))
      foreign = other.canned_responses.create!(
        short_code: 'ajeno', content: 'x',
        actions: [{ 'action_name' => 'set_ai_agent', 'action_params' => { 'enabled' => false } }]
      )

      send_message(content_attributes: { canned_response_id: foreign.id })

      expect(response).to have_http_status(:created)
      expect(conversation.reload.ai_agent_enabled).to be true
    end
  end
end

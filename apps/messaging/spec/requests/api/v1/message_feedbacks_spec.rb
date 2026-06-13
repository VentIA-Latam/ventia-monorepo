require 'rails_helper'

RSpec.describe 'Api::V1::MessageFeedbacks', type: :request do
  let(:account)       { create(:account, ventia_tenant_id: rand(100_000..999_999)) }
  let(:user)          { create(:user, ventia_user_id: rand(100_000..999_999)) }
  # administrator para que pase el RBAC del export; el PUT/DELETE no gatea rol en Rails.
  let!(:account_user) { AccountUser.create!(account: account, user: user, role: :administrator) }
  let(:conversation)  { create(:conversation, account: account) }
  let(:api_key)       { 'test-api-key' }

  let(:headers) do
    {
      'X-Tenant-Id'  => account.ventia_tenant_id.to_s,
      'X-User-Id'    => user.ventia_user_id.to_s,
      'X-API-Key'    => api_key,
      'Content-Type' => 'application/json'
    }
  end

  before { ENV['MESSAGING_SERVICE_API_KEY'] = api_key }
  after  { ENV.delete('MESSAGING_SERVICE_API_KEY') }

  def create_message(type: :outgoing, sender: nil, content: 'Respuesta IA', attrs: {})
    m = conversation.messages.new(
      account: account, inbox: conversation.inbox,
      message_type: type, sender: sender, content: content,
      content_type: :text, content_attributes: attrs
    )
    m.skip_send_reply = true
    m.save!
    m
  end

  let(:ai_message) { create_message }

  def feedback_path(message)
    "/api/v1/conversations/#{conversation.id}/messages/#{message.id}/feedback"
  end

  describe "PUT #{'feedback'}" do
    it 'creates a like for an AI message' do
      expect do
        put feedback_path(ai_message), params: { rating: 'like' }.to_json, headers: headers
      end.to change(MessageFeedback, :count).by(1)

      expect(response).to have_http_status(:ok)
      expect(response.parsed_body['data']['rating']).to eq('like')
      fb = MessageFeedback.last
      expect(fb.user_id).to eq(user.id)
      expect(fb.comment).to be_nil
    end

    it 'upserts the existing vote (latest wins, one row per agent)' do
      put feedback_path(ai_message), params: { rating: 'like' }.to_json, headers: headers
      put feedback_path(ai_message),
          params: { rating: 'dislike', comment: 'Precio incorrecto' }.to_json, headers: headers

      expect(MessageFeedback.where(message: ai_message, user: user).count).to eq(1)
      fb = MessageFeedback.last
      expect(fb.rating).to eq('dislike')
      expect(fb.comment).to eq('Precio incorrecto')
    end

    it 'rejects a dislike without a comment (422)' do
      put feedback_path(ai_message), params: { rating: 'dislike' }.to_json, headers: headers
      expect(response).to have_http_status(:unprocessable_entity)
      expect(MessageFeedback.count).to eq(0)
    end

    it 'rejects feedback on a non-AI message sent by an operator (422)' do
      operator_msg = create_message(sender: user)
      put feedback_path(operator_msg), params: { rating: 'like' }.to_json, headers: headers
      expect(response).to have_http_status(:unprocessable_entity)
    end

    it 'rejects feedback on an external echo (422)' do
      echo = create_message(attrs: { 'external_echo' => true })
      put feedback_path(echo), params: { rating: 'like' }.to_json, headers: headers
      expect(response).to have_http_status(:unprocessable_entity)
    end

    it 'rejects feedback on a template message (no es IA) (422)' do
      template = create_message(type: :template, content: 'Plantilla aprobada')
      put feedback_path(template), params: { rating: 'like' }.to_json, headers: headers
      expect(response).to have_http_status(:unprocessable_entity)
    end

    it 'rejects an invalid rating value (422)' do
      put feedback_path(ai_message), params: { rating: 'maybe' }.to_json, headers: headers
      expect(response).to have_http_status(:unprocessable_entity)
    end

    it 'returns 404 for a message of another account' do
      other_account = create(:account, ventia_tenant_id: rand(100_000..999_999))
      other_conv = create(:conversation, account: other_account)
      other_msg = other_conv.messages.create!(
        account: other_account, inbox: other_conv.inbox,
        message_type: :outgoing, content: 'IA ajena', content_type: :text
      ).tap { |m| m.skip_send_reply = true }

      put "/api/v1/conversations/#{other_conv.id}/messages/#{other_msg.id}/feedback",
          params: { rating: 'like' }.to_json, headers: headers
      expect(response).to have_http_status(:not_found)
    end
  end

  describe 'DELETE feedback' do
    it 'removes the current agent vote' do
      MessageFeedback.create!(
        message: ai_message, account: account, conversation: conversation, user: user, rating: :like
      )

      expect do
        delete feedback_path(ai_message), headers: headers
      end.to change(MessageFeedback, :count).by(-1)
      expect(response).to have_http_status(:ok)
    end
  end

  describe 'GET /api/v1/conversations/:id/messages (serialization)' do
    it "includes the current agent's feedback on the message" do
      MessageFeedback.create!(
        message: ai_message, account: account, conversation: conversation,
        user: user, rating: :dislike, comment: 'No respondió'
      )

      get "/api/v1/conversations/#{conversation.id}/messages", headers: headers

      expect(response).to have_http_status(:ok)
      msg = response.parsed_body['data'].find { |m| m['id'] == ai_message.id }
      expect(msg['feedback']).to include('rating' => 'dislike', 'comment' => 'No respondió')
    end

    it 'returns feedback: nil for messages the agent has not rated' do
      ai_message # crea el mensaje (let perezoso) antes de listar
      get "/api/v1/conversations/#{conversation.id}/messages", headers: headers
      msg = response.parsed_body['data'].find { |m| m['id'] == ai_message.id }
      expect(msg['feedback']).to be_nil
    end
  end

  describe 'GET /api/v1/message_feedbacks/export' do
    it 'returns NDJSON with one line per vote, including bot_response and context' do
      create_message(type: :incoming, sender: conversation.contact, content: '¿Cuánto cuesta?')
      bot = create_message(content: 'Cuesta 100 soles')
      MessageFeedback.create!(
        message: bot, account: account, conversation: conversation,
        user: user, rating: :dislike, comment: 'Precio inventado'
      )

      get '/api/v1/message_feedbacks/export', headers: headers

      expect(response).to have_http_status(:ok)
      expect(response.media_type).to eq('application/x-ndjson')
      lines = response.body.split("\n").reject(&:blank?)
      expect(lines.size).to eq(1)

      row = JSON.parse(lines.first)
      expect(row['rating']).to eq('dislike')
      expect(row['comment']).to eq('Precio inventado')
      expect(row['bot_response']).to eq('Cuesta 100 soles')
      expect(row['context']).to include('role' => 'customer', 'content' => '¿Cuánto cuesta?')
    end

    it 'filters by rating' do
      like_msg = create_message
      dislike_msg = create_message
      MessageFeedback.create!(message: like_msg, account: account, conversation: conversation, user: user, rating: :like)
      MessageFeedback.create!(message: dislike_msg, account: account, conversation: conversation, user: user, rating: :dislike, comment: 'mal')

      get '/api/v1/message_feedbacks/export', params: { rating: 'like' }, headers: headers

      lines = response.body.split("\n").reject(&:blank?)
      expect(lines.size).to eq(1)
      expect(JSON.parse(lines.first)['rating']).to eq('like')
    end

    it 'does not leak feedback from another account (tenant isolation)' do
      MessageFeedback.create!(message: ai_message, account: account, conversation: conversation, user: user, rating: :like)

      other_account = create(:account, ventia_tenant_id: rand(100_000..999_999))
      other_user = create(:user, ventia_user_id: rand(100_000..999_999))
      other_conv = create(:conversation, account: other_account)
      other_msg = other_conv.messages.new(
        account: other_account, inbox: other_conv.inbox,
        message_type: :outgoing, content: 'IA ajena', content_type: :text
      )
      other_msg.skip_send_reply = true
      other_msg.save!
      MessageFeedback.create!(message: other_msg, account: other_account, conversation: other_conv, user: other_user, rating: :like)

      get '/api/v1/message_feedbacks/export', headers: headers

      lines = response.body.split("\n").reject(&:blank?)
      expect(lines.size).to eq(1)
      expect(JSON.parse(lines.first)['message_id']).to eq(ai_message.id)
    end

    it 'respects the context window size' do
      create_message(type: :incoming, sender: conversation.contact, content: 'msg previo 1')
      create_message(type: :incoming, sender: conversation.contact, content: 'msg previo 2')
      bot = create_message(content: 'respuesta bot')
      MessageFeedback.create!(message: bot, account: account, conversation: conversation, user: user, rating: :like)

      get '/api/v1/message_feedbacks/export', params: { context: 1 }, headers: headers

      row = JSON.parse(response.body.split("\n").reject(&:blank?).first)
      expect(row['context'].size).to eq(1)
      expect(row['context'].first['content']).to eq('msg previo 2')
    end

    it 'tags context roles (customer/ai/agent)' do
      create_message(type: :incoming, sender: conversation.contact, content: 'cliente')
      create_message(content: 'respuesta IA previa')
      create_message(sender: user, content: 'respuesta de agente')
      bot = create_message(content: 'respuesta evaluada')
      MessageFeedback.create!(message: bot, account: account, conversation: conversation, user: user, rating: :like)

      get '/api/v1/message_feedbacks/export', params: { context: 3 }, headers: headers

      roles = JSON.parse(response.body.split("\n").reject(&:blank?).first)['context'].map { |c| c['role'] }
      expect(roles).to eq(%w[customer ai agent])
    end

    it 'rejects export for a non-admin agent (403)' do
      agent_user = create(:user, ventia_user_id: rand(100_000..999_999))
      AccountUser.create!(account: account, user: agent_user, role: :agent)
      agent_headers = headers.merge('X-User-Id' => agent_user.ventia_user_id.to_s)

      get '/api/v1/message_feedbacks/export', headers: agent_headers
      expect(response).to have_http_status(:forbidden)
    end
  end

  describe 'feedback lookup per agent in messages index' do
    it 'only returns the requesting agent feedback, not other agents votes' do
      other_user = create(:user, ventia_user_id: rand(100_000..999_999))
      AccountUser.create!(account: account, user: other_user, role: :agent)
      MessageFeedback.create!(message: ai_message, account: account, conversation: conversation, user: other_user, rating: :dislike, comment: 'voto ajeno')

      get "/api/v1/conversations/#{conversation.id}/messages", headers: headers
      msg = response.parsed_body['data'].find { |m| m['id'] == ai_message.id }
      expect(msg['feedback']).to be_nil # el agente actual no votó; no ve el voto del otro
    end
  end
end

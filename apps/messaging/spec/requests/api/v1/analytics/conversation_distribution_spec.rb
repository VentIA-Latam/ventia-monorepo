require 'rails_helper'

RSpec.describe 'GET /api/v1/analytics/conversation_distribution', type: :request do
  let(:account) { create(:account) }
  let(:inbox)   { create(:inbox, account: account) }
  let(:contact) { create(:contact, account: account) }

  let(:api_key) { 'test-messaging-service-api-key-abc123' }
  let(:headers) do
    {
      'X-Tenant-Id' => account.ventia_tenant_id.to_s,
      'X-API-Key'   => api_key
    }
  end

  before { ENV['MESSAGING_SERVICE_API_KEY'] = api_key }
  after  { ENV.delete('MESSAGING_SERVICE_API_KEY') }

  def make_conversation(acc: account, inb: inbox, cont: contact, created_at: 1.day.ago)
    ci = create(:contact_inbox, contact: cont, inbox: inb)
    create(:conversation, account: acc, inbox: inb, contact: cont,
                          contact_inbox: ci, created_at: created_at)
  end

  def add_message(conversation, message_type:, sender: nil, created_at: 1.hour.ago)
    Message.create!(
      account: conversation.account, inbox: conversation.inbox, conversation: conversation,
      content: 'Hola', message_type: message_type, content_type: :text,
      sender: sender, created_at: created_at
    )
  end

  def get_kpi(params)
    get '/api/v1/analytics/conversation_distribution', headers: headers, params: params
  end

  def bucket(body, category)
    body['data']['distribution'].find { |d| d['category'] == category }
  end

  describe 'happy path' do
    it 'devuelve los tres buckets con la estructura esperada' do
      ai = make_conversation(created_at: 3.days.ago)
      add_message(ai, message_type: :outgoing, created_at: 2.hours.ago) # IA reciente

      hum = make_conversation(created_at: 3.days.ago)
      add_message(hum, message_type: :outgoing,
                       sender: create(:user), created_at: 2.hours.ago)

      aband = make_conversation(created_at: 5.days.ago)
      add_message(aband, message_type: :outgoing, created_at: 2.days.ago) # saliente +24h

      get_kpi(start_date: 10.days.ago.iso8601, end_date: Time.current.iso8601)

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body['success']).to eq(true)
      expect(body['data']['total_conversations']).to eq(3)
      expect(bucket(body, 'agent_ai')['count']).to eq(1)
      expect(bucket(body, 'human_support')['count']).to eq(1)
      expect(bucket(body, 'abandoned')['count']).to eq(1)
    end

    it 'respeta el rango de fechas (filtra por created_at)' do
      old = make_conversation(created_at: 20.days.ago)
      add_message(old, message_type: :outgoing, created_at: 2.hours.ago)

      get_kpi(start_date: 5.days.ago.iso8601, end_date: Time.current.iso8601)

      body = JSON.parse(response.body)
      expect(body['data']['total_conversations']).to eq(0)
    end
  end

  describe 'cross_tenant' do
    it 'agrega conversaciones de todos los tenants cuando cross_tenant=true' do
      mine = make_conversation(created_at: 2.days.ago)
      add_message(mine, message_type: :outgoing, created_at: 2.hours.ago)

      other_account = create(:account)
      other_inbox   = create(:inbox, account: other_account)
      other_contact = create(:contact, account: other_account)
      theirs = make_conversation(acc: other_account, inb: other_inbox,
                                 cont: other_contact, created_at: 2.days.ago)
      add_message(theirs, message_type: :outgoing, created_at: 2.hours.ago)

      get_kpi(start_date: 10.days.ago.iso8601, end_date: Time.current.iso8601, cross_tenant: 'true')

      body = JSON.parse(response.body)
      expect(body['data']['total_conversations']).to eq(2)
    end
  end

  describe 'edge cases' do
    it 'devuelve total=0 y los tres buckets en cero sin conversaciones' do
      get_kpi(start_date: 10.days.ago.iso8601, end_date: Time.current.iso8601)

      body = JSON.parse(response.body)
      expect(body['data']['total_conversations']).to eq(0)
      expect(body['data']['distribution'].map { |d| d['count'] }).to all(eq(0))
    end

    it 'rechaza fechas inválidas con 400' do
      get_kpi(start_date: 'no-es-fecha', end_date: Time.current.iso8601)
      expect(response).to have_http_status(:bad_request)
    end
  end

  describe 'autenticación' do
    it 'rechaza con 401 si falta X-API-Key' do
      get '/api/v1/analytics/conversation_distribution',
          headers: headers.except('X-API-Key'),
          params: { start_date: 1.day.ago.iso8601, end_date: Time.current.iso8601 }
      expect(response).to have_http_status(:unauthorized)
    end
  end
end

require 'rails_helper'

RSpec.describe 'GET /api/v1/analytics/chats_started', type: :request do
  let(:account) { create(:account) }
  let(:inbox)   { create(:inbox, account: account, name: 'WA Ventas') }
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

  def get_kpi(params)
    get '/api/v1/analytics/chats_started', headers: headers, params: params
  end

  describe 'happy path' do
    it 'devuelve results, total y available_inboxes con la estructura esperada' do
      make_conversation(created_at: 2.days.ago)
      make_conversation(created_at: 2.days.ago)
      make_conversation(created_at: 1.day.ago)

      get_kpi(start_date: 5.days.ago.iso8601, end_date: Time.current.iso8601, timezone: 'America/Lima')

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body['success']).to eq(true)
      expect(body['data']['total']).to eq(3)
      expect(body['data']['results']).to be_an(Array)
      expect(body['data']['results'].first).to include('date', 'count')
      expect(body['data']['available_inboxes'].map { |i| i['name'] }).to include('WA Ventas')
    end

    it 'respeta el rango de fechas (filtra por created_at)' do
      make_conversation(created_at: 20.days.ago)

      get_kpi(start_date: 5.days.ago.iso8601, end_date: Time.current.iso8601)

      body = JSON.parse(response.body)
      expect(body['data']['total']).to eq(0)
    end

    it 'filtra por inbox_id' do
      other_inbox = create(:inbox, account: account, name: 'WA Soporte')
      make_conversation(created_at: 1.day.ago)                 # WA Ventas
      make_conversation(inb: other_inbox, created_at: 1.day.ago) # WA Soporte

      get_kpi(start_date: 5.days.ago.iso8601, end_date: Time.current.iso8601, inbox_id: inbox.id)

      body = JSON.parse(response.body)
      expect(body['data']['total']).to eq(1)
    end
  end

  describe 'cross_tenant' do
    it 'agrega conversaciones de todos los tenants y devuelve available_inboxes vacío' do
      make_conversation(created_at: 2.days.ago)

      other_account = create(:account)
      other_inbox   = create(:inbox, account: other_account)
      other_contact = create(:contact, account: other_account)
      make_conversation(acc: other_account, inb: other_inbox, cont: other_contact, created_at: 2.days.ago)

      get_kpi(start_date: 10.days.ago.iso8601, end_date: Time.current.iso8601, cross_tenant: 'true')

      body = JSON.parse(response.body)
      expect(body['data']['total']).to eq(2)
      expect(body['data']['available_inboxes']).to eq([])
    end
  end

  describe 'edge cases' do
    it 'devuelve total=0 con la serie en cero sin conversaciones' do
      get_kpi(start_date: 5.days.ago.iso8601, end_date: Time.current.iso8601)

      body = JSON.parse(response.body)
      expect(body['data']['total']).to eq(0)
      expect(body['data']['results'].map { |r| r['count'] }).to all(eq(0))
    end

    it 'rechaza fechas inválidas con 400' do
      get_kpi(start_date: 'no-es-fecha', end_date: Time.current.iso8601)
      expect(response).to have_http_status(:bad_request)
    end

    it 'rechaza timezone inválida con 400' do
      get_kpi(start_date: 5.days.ago.iso8601, end_date: Time.current.iso8601, timezone: 'Mars/Phobos')
      expect(response).to have_http_status(:bad_request)
    end
  end

  describe 'autenticación' do
    it 'rechaza con 401 si falta X-API-Key' do
      get '/api/v1/analytics/chats_started',
          headers: headers.except('X-API-Key'),
          params: { start_date: 1.day.ago.iso8601, end_date: Time.current.iso8601 }
      expect(response).to have_http_status(:unauthorized)
    end
  end
end

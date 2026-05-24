require 'rails_helper'

RSpec.describe 'GET /api/v1/analytics/no_purchase_reasons', type: :request do
  let(:account) { create(:account) }
  let(:inbox)   { create(:inbox, account: account) }

  let(:api_key) { 'test-messaging-service-api-key-abc123' }
  let(:headers) do
    {
      'X-Tenant-Id' => account.ventia_tenant_id.to_s,
      'X-API-Key'   => api_key
    }
  end

  before { ENV['MESSAGING_SERVICE_API_KEY'] = api_key }
  after  { ENV.delete('MESSAGING_SERVICE_API_KEY') }

  def make_conversation(reason: nil, created_at: 1.day.ago)
    contact = create(:contact, account: account)
    ci      = create(:contact_inbox, contact: contact, inbox: inbox)
    attrs   = reason.present? ? { 'no_purchase_reason' => reason } : {}
    create(:conversation,
           account: account, inbox: inbox, contact: contact, contact_inbox: ci,
           created_at: created_at,
           custom_attributes: attrs)
  end

  def get_kpi(start_date:, end_date:)
    get '/api/v1/analytics/no_purchase_reasons',
        headers: headers,
        params: { start_date: start_date, end_date: end_date }
  end

  describe 'happy path' do
    before do
      make_conversation(reason: 'Precio',  created_at: 5.days.ago)
      make_conversation(reason: 'Precio',  created_at: 4.days.ago)
      make_conversation(reason: 'Precio',  created_at: 3.days.ago)
      make_conversation(reason: 'Sin stock', created_at: 2.days.ago)
      make_conversation(reason: nil,       created_at: 1.day.ago) # excluido
    end

    it 'agrupa por motivo y calcula porcentajes sobre el total con motivo' do
      get_kpi(start_date: 10.days.ago.iso8601, end_date: Time.current.iso8601)

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body['success']).to eq(true)
      expect(body['data']['total']).to eq(4)

      results = body['data']['results']
      expect(results.size).to eq(2)
      expect(results[0]).to include('reason' => 'Precio', 'count' => 3, 'percentage' => 75.0)
      expect(results[1]).to include('reason' => 'Sin stock', 'count' => 1, 'percentage' => 25.0)
    end

    it 'ordena resultados de mayor a menor count' do
      get_kpi(start_date: 10.days.ago.iso8601, end_date: Time.current.iso8601)

      counts = JSON.parse(response.body)['data']['results'].map { |r| r['count'] }
      expect(counts).to eq(counts.sort.reverse)
    end

    it 'respeta el rango de fechas (filtra por created_at)' do
      get_kpi(start_date: 3.days.ago.iso8601, end_date: Time.current.iso8601)

      body = JSON.parse(response.body)
      # Solo 2 dentro del rango (1 "Precio" hace 3 días + 1 "Sin stock" hace 2)
      expect(body['data']['total']).to eq(2)
    end

    it 'excluye conversaciones sin no_purchase_reason' do
      get_kpi(start_date: 10.days.ago.iso8601, end_date: Time.current.iso8601)

      reasons = JSON.parse(response.body)['data']['results'].map { |r| r['reason'] }
      expect(reasons).not_to include(nil)
    end
  end

  describe 'edge cases' do
    it 'devuelve total=0 y results vacío cuando no hay conversaciones con motivo' do
      get_kpi(start_date: 10.days.ago.iso8601, end_date: Time.current.iso8601)

      body = JSON.parse(response.body)
      expect(body['data']['total']).to eq(0)
      expect(body['data']['results']).to eq([])
    end

    it 'no incluye conversaciones de otro tenant' do
      other_account = create(:account)
      other_inbox   = create(:inbox, account: other_account)
      other_contact = create(:contact, account: other_account)
      other_ci      = create(:contact_inbox, contact: other_contact, inbox: other_inbox)
      create(:conversation,
             account: other_account, inbox: other_inbox, contact: other_contact,
             contact_inbox: other_ci,
             created_at: 2.days.ago,
             custom_attributes: { 'no_purchase_reason' => 'Otro tenant' })

      get_kpi(start_date: 10.days.ago.iso8601, end_date: Time.current.iso8601)
      reasons = JSON.parse(response.body)['data']['results'].map { |r| r['reason'] }
      expect(reasons).not_to include('Otro tenant')
    end
  end

  describe 'autenticación' do
    it 'rechaza con 401 si falta X-API-Key' do
      get '/api/v1/analytics/no_purchase_reasons',
          headers: headers.except('X-API-Key'),
          params: { start_date: 1.day.ago.iso8601, end_date: Time.current.iso8601 }
      expect(response).to have_http_status(:unauthorized)
    end
  end
end

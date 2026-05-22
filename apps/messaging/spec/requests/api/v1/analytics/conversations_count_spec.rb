require 'rails_helper'

RSpec.describe 'Api::V1::Analytics::Conversations Count', type: :request do
  let(:account) { create(:account) }
  let(:other_account) { create(:account) }
  let(:api_key) { 'test-messaging-service-api-key-abc123' }
  let(:headers) do
    {
      'X-Tenant-Id' => account.ventia_tenant_id.to_s,
      'X-API-Key' => api_key
    }
  end

  before { ENV['MESSAGING_SERVICE_API_KEY'] = api_key }
  after  { ENV.delete('MESSAGING_SERVICE_API_KEY') }

  before do
    create_list(:conversation, 3, account: account, created_at: 5.days.ago)
    create(:conversation, account: account, created_at: 40.days.ago)
    create(:conversation, account: other_account, created_at: 5.days.ago)
  end

  describe 'GET /api/v1/analytics/conversations_count' do
    context 'sin params (defaults: últimos 30 días)' do
      it 'cuenta solo conversaciones del tenant en últimos 30d' do
        get '/api/v1/analytics/conversations_count', headers: headers

        expect(response).to have_http_status(:ok)
        body = JSON.parse(response.body)
        expect(body['success']).to be true
        expect(body['data']['total']).to eq(3)
        expect(body['data']['period']).to include('start_date', 'end_date')
      end
    end

    context 'con start_date y end_date que incluyen toda la historia' do
      it 'respeta el rango y cuenta también conversación de hace 40 días' do
        get '/api/v1/analytics/conversations_count',
            params: { start_date: 50.days.ago.iso8601, end_date: Time.current.iso8601 },
            headers: headers

        expect(response).to have_http_status(:ok)
        expect(JSON.parse(response.body)['data']['total']).to eq(4)
      end
    end

    context 'sin X-Tenant-Id' do
      it 'devuelve 401' do
        get '/api/v1/analytics/conversations_count',
            headers: { 'X-API-Key' => api_key }
        expect(response).to have_http_status(:unauthorized)
      end
    end

    context 'con tenant inexistente' do
      it 'devuelve 404' do
        get '/api/v1/analytics/conversations_count',
            headers: { 'X-Tenant-Id' => '999999', 'X-API-Key' => api_key }

        expect(response).to have_http_status(:not_found)
      end
    end

    context 'con fechas inválidas' do
      it 'devuelve 400' do
        get '/api/v1/analytics/conversations_count',
            params: { start_date: 'no-es-fecha' },
            headers: headers

        expect(response).to have_http_status(:bad_request)
        expect(JSON.parse(response.body)['success']).to be false
      end
    end
  end
end

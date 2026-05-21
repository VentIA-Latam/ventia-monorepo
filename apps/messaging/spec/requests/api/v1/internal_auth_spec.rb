require 'rails_helper'

RSpec.describe 'Api::V1 internal auth (X-API-Key)', type: :request do
  let(:account) { create(:account) }
  let(:api_key) { 'test-messaging-service-api-key-abc123' }
  let(:tenant_header) { { 'X-Tenant-Id' => account.ventia_tenant_id.to_s } }
  let(:valid_headers) { tenant_header.merge('X-API-Key' => api_key) }

  describe 'GET /api/v1/analytics/conversations_count' do
    context 'cuando MESSAGING_SERVICE_API_KEY está configurada' do
      before { ENV['MESSAGING_SERVICE_API_KEY'] = api_key }
      after  { ENV.delete('MESSAGING_SERVICE_API_KEY') }

      it 'rechaza con 401 si no se envía X-API-Key' do
        get '/api/v1/analytics/conversations_count', headers: tenant_header

        expect(response).to have_http_status(:unauthorized)
        expect(JSON.parse(response.body)['error']).to match(/Invalid or missing API key/)
      end

      it 'rechaza con 401 si X-API-Key es inválida' do
        get '/api/v1/analytics/conversations_count',
            headers: tenant_header.merge('X-API-Key' => 'wrong-key')

        expect(response).to have_http_status(:unauthorized)
      end

      it 'acepta la request con X-API-Key válida y tenant válido' do
        get '/api/v1/analytics/conversations_count', headers: valid_headers

        expect(response).to have_http_status(:ok)
      end
    end

    context 'cuando MESSAGING_SERVICE_API_KEY no está configurada' do
      before { ENV.delete('MESSAGING_SERVICE_API_KEY') }

      it 'responde 500 (fail-closed) incluso con la key correcta' do
        get '/api/v1/analytics/conversations_count', headers: valid_headers

        expect(response).to have_http_status(:internal_server_error)
        expect(JSON.parse(response.body)['error']).to match(/not configured/)
      end
    end
  end
end

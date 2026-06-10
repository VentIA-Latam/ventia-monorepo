require 'rails_helper'

RSpec.describe 'Api::V1::CannedResponses', type: :request do
  let(:account) { create(:account, ventia_tenant_id: rand(100_000..999_999)) }
  let(:agent) { create(:user, ventia_user_id: rand(100_000..999_999)) }
  let(:admin) { create(:user, ventia_user_id: rand(100_000..999_999)) }
  let(:api_key) { 'test-api-key' }

  let!(:agent_membership) { AccountUser.create!(account: account, user: agent, role: :agent) }
  let!(:admin_membership) { AccountUser.create!(account: account, user: admin, role: :administrator) }

  def headers_for(user)
    {
      'X-Tenant-Id' => account.ventia_tenant_id.to_s,
      'X-User-Id' => user.ventia_user_id.to_s,
      'X-API-Key' => api_key,
      'Content-Type' => 'application/json'
    }
  end

  before { ENV['MESSAGING_SERVICE_API_KEY'] = api_key }
  after { ENV.delete('MESSAGING_SERVICE_API_KEY') }

  let!(:canned_response) do
    account.canned_responses.create!(short_code: 'saludo', content: 'Hola, ¿en qué te ayudo?')
  end

  describe 'GET /api/v1/canned_responses (read access)' do
    it 'agents can list canned responses' do
      get '/api/v1/canned_responses', headers: headers_for(agent)

      expect(response).to have_http_status(:ok)
      expect(response.parsed_body['data'].first['short_code']).to eq('saludo')
    end

    it 'filters by search term (short_code prefix prioritised)' do
      account.canned_responses.create!(short_code: 'despedida', content: 'Hasta luego')

      get '/api/v1/canned_responses', params: { search: 'salu' }, headers: headers_for(agent)

      codes = response.parsed_body['data'].map { |r| r['short_code'] }
      expect(codes).to eq(['saludo'])
    end

    it 'agents can show a canned response' do
      get "/api/v1/canned_responses/#{canned_response.id}", headers: headers_for(agent)

      expect(response).to have_http_status(:ok)
    end
  end

  describe 'write access is restricted to admin/superadmin' do
    let(:create_payload) { { canned_response: { short_code: 'gracias', content: '¡Gracias!' } }.to_json }

    context 'as an agent' do
      it 'forbids create' do
        post '/api/v1/canned_responses', params: create_payload, headers: headers_for(agent)
        expect(response).to have_http_status(:forbidden)
      end

      it 'forbids update' do
        patch "/api/v1/canned_responses/#{canned_response.id}",
              params: { canned_response: { content: 'editado' } }.to_json,
              headers: headers_for(agent)
        expect(response).to have_http_status(:forbidden)
      end

      it 'forbids destroy' do
        delete "/api/v1/canned_responses/#{canned_response.id}", headers: headers_for(agent)
        expect(response).to have_http_status(:forbidden)
        expect(CannedResponse.exists?(canned_response.id)).to be true
      end
    end

    context 'as an administrator' do
      it 'creates a canned response' do
        expect do
          post '/api/v1/canned_responses', params: create_payload, headers: headers_for(admin)
        end.to change(account.canned_responses, :count).by(1)

        expect(response).to have_http_status(:created)
        expect(response.parsed_body['data']['short_code']).to eq('gracias')
      end

      it 'updates a canned response' do
        patch "/api/v1/canned_responses/#{canned_response.id}",
              params: { canned_response: { content: 'editado' } }.to_json,
              headers: headers_for(admin)

        expect(response).to have_http_status(:ok)
        expect(canned_response.reload.content).to eq('editado')
      end

      it 'destroys a canned response' do
        delete "/api/v1/canned_responses/#{canned_response.id}", headers: headers_for(admin)

        expect(response).to have_http_status(:no_content)
        expect(CannedResponse.exists?(canned_response.id)).to be false
      end

      it 'rejects a duplicate short_code with 422' do
        post '/api/v1/canned_responses',
             params: { canned_response: { short_code: 'saludo', content: 'otra' } }.to_json,
             headers: headers_for(admin)

        expect(response).to have_http_status(:unprocessable_entity)
      end
    end

    context 'as a superadmin' do
      let(:superadmin) { create(:user, ventia_user_id: rand(100_000..999_999)) }
      let!(:superadmin_membership) do
        AccountUser.create!(account: account, user: superadmin, role: :superadmin)
      end

      it 'creates a canned response' do
        post '/api/v1/canned_responses',
             params: { canned_response: { short_code: 'gracias', content: '¡Gracias!' } }.to_json,
             headers: headers_for(superadmin)

        expect(response).to have_http_status(:created)
      end
    end
  end

  describe 'multi-tenant isolation (IDOR)' do
    let(:other_account) { create(:account, ventia_tenant_id: rand(100_000..999_999)) }
    let!(:other_canned_response) do
      other_account.canned_responses.create!(short_code: 'ajeno', content: 'De otra cuenta')
    end

    it 'returns 404 when an admin shows a canned response from another account' do
      get "/api/v1/canned_responses/#{other_canned_response.id}", headers: headers_for(admin)
      expect(response).to have_http_status(:not_found)
    end

    it 'returns 404 when an admin updates a canned response from another account' do
      patch "/api/v1/canned_responses/#{other_canned_response.id}",
            params: { canned_response: { content: 'hackeado' } }.to_json,
            headers: headers_for(admin)

      expect(response).to have_http_status(:not_found)
      expect(other_canned_response.reload.content).to eq('De otra cuenta')
    end

    it 'returns 404 when an admin destroys a canned response from another account' do
      delete "/api/v1/canned_responses/#{other_canned_response.id}", headers: headers_for(admin)

      expect(response).to have_http_status(:not_found)
      expect(CannedResponse.exists?(other_canned_response.id)).to be true
    end
  end
end

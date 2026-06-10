require 'rails_helper'

RSpec.describe 'GET /api/v1/campaigns/:id/preview', type: :request do
  let(:account)        { create(:account) }
  let(:inbox)          { create(:inbox, account: account) }
  let(:campaign)       { Campaign.create!(account: account, inbox: inbox, title: 'T', campaign_status: :draft) }

  let(:api_key) { 'test-messaging-service-api-key-abc123' }
  let(:headers) do
    {
      'X-Tenant-Id'  => account.ventia_tenant_id.to_s,
      'X-API-Key'    => api_key,
      'Content-Type' => 'application/json'
    }
  end

  before { ENV['MESSAGING_SERVICE_API_KEY'] = api_key }
  after  { ENV.delete('MESSAGING_SERVICE_API_KEY') }

  describe 'happy path con recipients y template sin variables' do
    let!(:recipient) do
      campaign.update!(
        template_params: { 'name' => 'jockey', 'language' => 'es', 'variables' => {} }
      )
      campaign.campaign_recipients.create!(phone: '+51900000001', status: :pending)
    end

    before do
      # Stub el builder — el test foco es que el endpoint devuelva 200 con el shape correcto.
      allow_any_instance_of(Whatsapp::TemplateMessageBuilder).to receive(:build).and_return(
        content: 'Hola',
        message_type: :template,
        additional_attributes: {}
      )
    end

    it 'devuelve 200 con el shape esperado' do
      get "/api/v1/campaigns/#{campaign.id}/preview", headers: headers

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body['success']).to be true
      expect(body['data']).to include(
        'template_name'    => 'jockey',
        'recipients_count' => 1,
        'samples'          => kind_of(Array),
        'omitted_samples'  => kind_of(Array)
      )
    end

    # Regression: render_success debe envolver el hash en {} explícito porque
    # Ruby 3.4 interpreta los key:value como kwargs cuando no hay positional arg
    # explícito, lo que hace que `data` quede vacío y dispara ArgumentError →
    # rescue_from global devuelve 400.
    it 'NO devuelve 400 (bug regression: render_success con kwargs sin {})' do
      get "/api/v1/campaigns/#{campaign.id}/preview", headers: headers
      expect(response).not_to have_http_status(:bad_request)
    end
  end

  describe 'campaña vacía (sin recipients)' do
    it 'devuelve empty_preview con recipients_count: 0' do
      get "/api/v1/campaigns/#{campaign.id}/preview", headers: headers
      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body['data']['recipients_count']).to eq(0)
      expect(body['data']['samples']).to be_empty
    end
  end
end

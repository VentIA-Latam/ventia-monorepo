require 'rails_helper'

RSpec.describe 'Campaigns API · lifecycle (create/update/trigger/retry)', type: :request do
  include ActiveJob::TestHelper

  let(:account)  { create(:account) }
  let(:inbox)    { create(:inbox, account: account) }

  let(:api_key)  { 'test-messaging-service-api-key-abc123' }
  let(:headers) do
    {
      'X-Tenant-Id'  => account.ventia_tenant_id.to_s,
      'X-API-Key'    => api_key,
      'Content-Type' => 'application/json'
    }
  end

  before do
    ENV['MESSAGING_SERVICE_API_KEY'] = api_key
    ActiveJob::Base.queue_adapter = :test
  end
  after { ENV.delete('MESSAGING_SERVICE_API_KEY') }

  describe 'POST /api/v1/campaigns' do
    let(:body) do
      {
        campaign: {
          title: 'Marketing Junio',
          inbox_id: inbox.id,
          template_params: { name: 'jockey', language: 'es', variables: {} }
        }
      }
    end

    it 'crea con default :draft' do
      post '/api/v1/campaigns', params: body.to_json, headers: headers
      expect(response).to have_http_status(:created)
      data = JSON.parse(response.body)['data']
      expect(data['campaign_status']).to eq('draft')
      expect(data['template_params']['name']).to eq('jockey')
    end

    it '422 cuando inbox no es WhatsApp' do
      ig_inbox = create(:inbox, account: account, channel: create(:channel_instagram, account: account))
      payload = body.deep_merge(campaign: { inbox_id: ig_inbox.id }).to_json
      post '/api/v1/campaigns', params: payload, headers: headers
      expect(response).to have_http_status(:unprocessable_entity)
    end
  end

  describe 'PATCH /api/v1/campaigns/:id' do
    let(:campaign) { Campaign.create!(account: account, inbox: inbox, title: 'X', campaign_status: :draft) }

    it 'actualiza template_params en :draft' do
      patch "/api/v1/campaigns/#{campaign.id}",
            params: { campaign: { template_params: { name: 'jockey', language: 'es', variables: { '1' => { source: 'csv_column', key: 'cliente' } } } } }.to_json,
            headers: headers
      expect(response).to have_http_status(:ok)
      expect(campaign.reload.template_params.dig('variables', '1', 'key')).to eq('cliente')
    end

    it '422 cuando campaña no está en :draft' do
      campaign.update!(campaign_status: :active)
      patch "/api/v1/campaigns/#{campaign.id}",
            params: { campaign: { title: 'X2' } }.to_json,
            headers: headers
      expect(response).to have_http_status(:unprocessable_entity)
    end
  end

  describe 'POST /api/v1/campaigns/:id/trigger' do
    let(:campaign) { Campaign.create!(account: account, inbox: inbox, title: 'X', campaign_status: :draft) }

    before do
      campaign.campaign_recipients.create!(phone: '+51900000001', status: :pending)
    end

    it 'inmediato: scheduled_at nil → :active y encola TriggerJob' do
      expect {
        post "/api/v1/campaigns/#{campaign.id}/trigger", params: {}.to_json, headers: headers
      }.to have_enqueued_job(Campaigns::TriggerJob).with(campaign.id)

      expect(response).to have_http_status(:ok)
      expect(campaign.reload.campaign_status).to eq('active')
    end

    it 'programado: scheduled_at futuro → :active sin encolar TriggerJob' do
      future = (Time.current + 1.hour).iso8601
      expect {
        post "/api/v1/campaigns/#{campaign.id}/trigger",
             params: { scheduled_at: future }.to_json, headers: headers
      }.not_to have_enqueued_job(Campaigns::TriggerJob)

      expect(response).to have_http_status(:ok)
      expect(campaign.reload.campaign_status).to eq('active')
      expect(campaign.scheduled_at).to be_within(2.seconds).of(Time.parse(future))
    end

    it '422 cuando campaña no es :draft' do
      campaign.update!(campaign_status: :active)
      post "/api/v1/campaigns/#{campaign.id}/trigger", params: {}.to_json, headers: headers
      expect(response).to have_http_status(:unprocessable_entity)
    end

    it '422 cuando no hay recipients' do
      Campaign.create!(account: account, inbox: inbox, title: 'empty', campaign_status: :draft).tap do |c|
        post "/api/v1/campaigns/#{c.id}/trigger", params: {}.to_json, headers: headers
      end
      expect(response).to have_http_status(:unprocessable_entity)
    end
  end

  describe 'POST /api/v1/campaigns/:id/retry-failed' do
    let(:campaign) { Campaign.create!(account: account, inbox: inbox, title: 'X', campaign_status: :completed, failed_count: 2) }
    let!(:f1) { campaign.campaign_recipients.create!(phone: '+51900000001', status: :failed, external_error: 'meta') }
    let!(:f2) { campaign.campaign_recipients.create!(phone: '+51900000002', status: :failed, external_error: 'meta') }
    let!(:sent) { campaign.campaign_recipients.create!(phone: '+51900000003', status: :sent) }

    it 'resetea failed → pending y encola TriggerJob' do
      expect {
        post "/api/v1/campaigns/#{campaign.id}/retry-failed", params: {}.to_json, headers: headers
      }.to have_enqueued_job(Campaigns::TriggerJob).with(campaign.id)

      expect(response).to have_http_status(:ok)
      expect(JSON.parse(response.body)['data']['retrying']).to eq(2)
      expect(f1.reload.status).to eq('pending')
      expect(f2.reload.status).to eq('pending')
      expect(sent.reload.status).to eq('sent')
    end

    it '422 cuando campaña no es :completed' do
      campaign.update!(campaign_status: :running)
      post "/api/v1/campaigns/#{campaign.id}/retry-failed", params: {}.to_json, headers: headers
      expect(response).to have_http_status(:unprocessable_entity)
    end
  end
end

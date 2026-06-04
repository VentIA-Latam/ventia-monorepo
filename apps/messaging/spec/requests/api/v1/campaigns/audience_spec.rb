require 'rails_helper'

RSpec.describe 'Campaigns API · audience (CSV + labels)', type: :request do
  let(:account)  { create(:account) }
  let(:inbox)    { create(:inbox, account: account) }
  let(:campaign) { Campaign.create!(account: account, inbox: inbox, title: 'X', campaign_status: :draft) }

  let(:api_key)  { 'test-messaging-service-api-key-abc123' }
  let(:headers) do
    {
      'X-Tenant-Id'  => account.ventia_tenant_id.to_s,
      'X-API-Key'    => api_key,
      'Content-Type' => 'application/json'
    }
  end

  before { ENV['MESSAGING_SERVICE_API_KEY'] = api_key }
  after  { ENV.delete('MESSAGING_SERVICE_API_KEY') }

  describe 'POST /api/v1/campaigns/:id/audience/csv' do
    let(:csv_content) do
      <<~CSV
        phone,cliente,pedido
        +51999888777,Juan,ORD-12345
        +51998877665,María,ORD-12346
      CSV
    end
    let(:file) { Rack::Test::UploadedFile.new(StringIO.new(csv_content), 'text/csv', original_filename: 'audience.csv') }

    it 'crea recipients del CSV' do
      multipart_headers = headers.except('Content-Type')
      post "/api/v1/campaigns/#{campaign.id}/audience/csv",
           params: { file: file }, headers: multipart_headers

      expect(response).to have_http_status(:created)
      body = JSON.parse(response.body)['data']
      expect(body['recipients_count']).to eq(2)
      expect(body['columns']).to eq(%w[cliente pedido])
      expect(campaign.reload.recipients_count).to eq(2)
      expect(campaign.audience_type).to eq('csv')
    end

    it '422 cuando no se manda file' do
      post "/api/v1/campaigns/#{campaign.id}/audience/csv", params: {}, headers: headers.except('Content-Type')
      expect(response).to have_http_status(:unprocessable_entity)
    end

    it '422 cuando CSV no tiene columna phone' do
      bad_csv = "nombre,pedido\nJuan,ORD-1\n"
      bad_file = Rack::Test::UploadedFile.new(StringIO.new(bad_csv), 'text/csv', original_filename: 'x.csv')
      post "/api/v1/campaigns/#{campaign.id}/audience/csv",
           params: { file: bad_file }, headers: headers.except('Content-Type')
      expect(response).to have_http_status(:unprocessable_entity)
      expect(JSON.parse(response.body)['error']).to match(/phone/i)
    end

    it 'reemplaza recipients previos al re-subir' do
      multipart_headers = headers.except('Content-Type')
      post "/api/v1/campaigns/#{campaign.id}/audience/csv",
           params: { file: file }, headers: multipart_headers
      first_count = JSON.parse(response.body)['data']['recipients_count']

      new_csv = "phone,cliente\n+51999111111,Pedro\n"
      new_file = Rack::Test::UploadedFile.new(StringIO.new(new_csv), 'text/csv', original_filename: 'x.csv')
      post "/api/v1/campaigns/#{campaign.id}/audience/csv",
           params: { file: new_file }, headers: multipart_headers
      expect(JSON.parse(response.body)['data']['recipients_count']).to eq(1)
      expect(campaign.reload.campaign_recipients.count).to eq(1)
    end
  end

  describe 'POST /api/v1/campaigns/:id/audience/labels' do
    let(:label) { create(:label, account: account, title: 'pendiente') }
    let!(:contact_with_label) do
      contact = create(:contact, account: account, phone_number: '+51900000010')
      conv = create(:conversation, account: account, inbox: inbox, contact: contact)
      conv.conversation_labels.create!(label: label)
      contact
    end

    it 'crea snapshot de recipients' do
      post "/api/v1/campaigns/#{campaign.id}/audience/labels",
           params: { label_ids: [label.id] }.to_json, headers: headers
      expect(response).to have_http_status(:created)
      expect(JSON.parse(response.body)['data']['recipients_count']).to eq(1)
      expect(campaign.reload.audience_type).to eq('labels')
    end

    it '422 cuando label_ids vacío' do
      post "/api/v1/campaigns/#{campaign.id}/audience/labels",
           params: { label_ids: [] }.to_json, headers: headers
      expect(response).to have_http_status(:unprocessable_entity)
    end

    it '422 cuando campaña no es :draft' do
      campaign.update!(campaign_status: :active)
      post "/api/v1/campaigns/#{campaign.id}/audience/labels",
           params: { label_ids: [label.id] }.to_json, headers: headers
      expect(response).to have_http_status(:unprocessable_entity)
    end
  end
end

require 'rails_helper'

RSpec.describe 'POST /api/v1/conversations/:id/no_purchase_reason', type: :request do
  let(:account) { create(:account) }
  let(:inbox)   { create(:inbox, account: account) }
  let(:contact) { create(:contact, account: account) }
  let(:contact_inbox) { create(:contact_inbox, contact: contact, inbox: inbox) }
  let(:conversation) do
    create(:conversation, account: account, inbox: inbox, contact: contact,
                          contact_inbox: contact_inbox)
  end

  let(:api_key) { 'test-messaging-service-api-key-abc123' }
  let(:headers) do
    {
      'X-Tenant-Id' => account.ventia_tenant_id.to_s,
      'X-API-Key'   => api_key,
      'Content-Type' => 'application/json'
    }
  end

  before { ENV['MESSAGING_SERVICE_API_KEY'] = api_key }
  after  { ENV.delete('MESSAGING_SERVICE_API_KEY') }

  def post_reason(reason, conversation_id: conversation.id)
    post "/api/v1/conversations/#{conversation_id}/no_purchase_reason",
         params: { reason: reason }.to_json,
         headers: headers
  end

  describe 'happy path' do
    it 'guarda el motivo en custom_attributes y retorna 200' do
      post_reason('Precio muy alto')

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body['success']).to eq(true)
      expect(body['data']).to include(
        'conversation_id' => conversation.id,
        'reason'          => 'Precio muy alto'
      )
      expect(conversation.reload.custom_attributes['no_purchase_reason']).to eq('Precio muy alto')
    end

    it 'preserva otras claves de custom_attributes (merge, no replace)' do
      conversation.update!(custom_attributes: { 'source' => 'shopify', 'order_id' => 42 })
      post_reason('Sin stock')

      attrs = conversation.reload.custom_attributes
      expect(attrs['no_purchase_reason']).to eq('Sin stock')
      expect(attrs['source']).to eq('shopify')
      expect(attrs['order_id']).to eq(42)
    end

    it 'sobreescribe el motivo previo en llamadas subsecuentes' do
      post_reason('Precio')
      post_reason('Sin tiempo')

      expect(response).to have_http_status(:ok)
      expect(conversation.reload.custom_attributes['no_purchase_reason']).to eq('Sin tiempo')
    end

    it 'normaliza espacios en blanco al borde del motivo' do
      post_reason('  Precio alto  ')
      expect(conversation.reload.custom_attributes['no_purchase_reason']).to eq('Precio alto')
    end
  end

  describe 'validaciones' do
    it 'rechaza con 422 si el motivo está vacío' do
      post_reason('')

      expect(response).to have_http_status(:unprocessable_entity)
      body = JSON.parse(response.body)
      expect(body['success']).to eq(false)
      expect(body['error']).to eq('reason_required')
    end

    it 'rechaza con 422 si el motivo es solo espacios' do
      post_reason('   ')

      expect(response).to have_http_status(:unprocessable_entity)
      expect(JSON.parse(response.body)['error']).to eq('reason_required')
    end

    it 'rechaza con 404 si la conversación no existe' do
      post_reason('Precio', conversation_id: 999_999_999)
      expect(response).to have_http_status(:not_found)
    end

    it 'no permite acceder a conversaciones de otro tenant' do
      other_account = create(:account)
      other_inbox   = create(:inbox, account: other_account)
      other_contact = create(:contact, account: other_account)
      other_ci      = create(:contact_inbox, contact: other_contact, inbox: other_inbox)
      other_conv    = create(:conversation, account: other_account, inbox: other_inbox,
                                            contact: other_contact, contact_inbox: other_ci)

      post_reason('Hack', conversation_id: other_conv.id)
      expect(response).to have_http_status(:not_found)
    end
  end

  describe 'autenticación' do
    it 'rechaza con 401 si falta X-API-Key' do
      post "/api/v1/conversations/#{conversation.id}/no_purchase_reason",
           params: { reason: 'Precio' }.to_json,
           headers: headers.except('X-API-Key')
      expect(response).to have_http_status(:unauthorized)
    end

    it 'rechaza con 401 si falta X-Tenant-Id' do
      post "/api/v1/conversations/#{conversation.id}/no_purchase_reason",
           params: { reason: 'Precio' }.to_json,
           headers: headers.except('X-Tenant-Id')
      expect(response).to have_http_status(:unauthorized)
    end
  end
end

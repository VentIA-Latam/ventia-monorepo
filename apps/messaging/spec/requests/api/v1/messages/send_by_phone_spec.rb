require 'rails_helper'

RSpec.describe 'POST /api/v1/messages/send_by_phone', type: :request do
  let(:account)        { create(:account) }
  let(:whatsapp_inbox) { create(:inbox, account: account) }
  let(:instagram_inbox) do
    create(:inbox, account: account, channel: create(:channel_instagram, account: account))
  end

  # Patrón espejo de spec/requests/api/v1/conversations/no_purchase_reason_spec.rb
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

  let(:valid_payload) do
    {
      phone:    '+51999888777',
      inbox_id: whatsapp_inbox.id,
      template_params: {
        name:             'promo_junio',
        language:         'es',
        processed_params: { body: { '1' => 'Juan' } }
      },
      contact_name: 'Juan Pérez'
    }
  end

  before do
    allow_any_instance_of(Whatsapp::TemplateMessageBuilder).to receive(:build).and_return(
      content:               'Hola Juan',
      message_type:          :template,
      additional_attributes: { 'template_params' => { 'name' => 'promo_junio' } }
    )
    allow_any_instance_of(Whatsapp::SendOnWhatsappService).to receive(:perform)
  end

  def post_send_by_phone(payload = valid_payload, custom_headers: headers)
    post '/api/v1/messages/send_by_phone', params: payload.to_json, headers: custom_headers
  end

  describe 'happy path' do
    it 'devuelve 201 y crea contact + conversation + message' do
      post_send_by_phone

      expect(response).to have_http_status(:created)
      body = JSON.parse(response.body)
      expect(body['success']).to be true
      expect(body['data']).to include('conversation_id', 'message_id', 'contact_id')
      expect(body['data']['contact_created']).to be true
      expect(body['data']['conversation_created']).to be true
    end

    it 'cuando se llama dos veces, la segunda reusa conversación open existente' do
      post_send_by_phone
      first_conversation_id = JSON.parse(response.body).dig('data', 'conversation_id')

      post_send_by_phone
      body = JSON.parse(response.body)

      expect(response).to have_http_status(:created)
      expect(body['data']['conversation_id']).to eq(first_conversation_id)
      expect(body['data']['contact_created']).to be false
      expect(body['data']['conversation_created']).to be false
    end
  end

  describe 'errores de validación' do
    it 'devuelve 422 cuando phone no es E.164' do
      post_send_by_phone(valid_payload.merge(phone: '999888777'))

      expect(response).to have_http_status(:unprocessable_entity)
      expect(JSON.parse(response.body)['error']).to include('E.164')
    end

    it 'devuelve 422 cuando inbox no es WhatsApp' do
      post_send_by_phone(valid_payload.merge(inbox_id: instagram_inbox.id))

      expect(response).to have_http_status(:unprocessable_entity)
      expect(JSON.parse(response.body)['error']).to include('WhatsApp')
    end

    it 'devuelve 404 cuando inbox_id no pertenece al tenant' do
      other_account = create(:account)
      other_inbox   = create(:inbox, account: other_account)
      post_send_by_phone(valid_payload.merge(inbox_id: other_inbox.id))

      expect(response).to have_http_status(:not_found)
    end

    it 'devuelve 422 cuando template_params está ausente' do
      payload = valid_payload.dup
      payload.delete(:template_params)
      post_send_by_phone(payload)

      expect(response).to have_http_status(:unprocessable_entity)
      expect(JSON.parse(response.body)['error']).to include('template_params')
    end

    it 'devuelve 422 cuando template_params llega como string mal formado (no JSON)' do
      # Evita NoMethodError 500 cuando un caller manda algo que no es Hash ni JSON válido.
      post_send_by_phone(valid_payload.merge(template_params: 'not-json-{{{'))

      expect(response).to have_http_status(:unprocessable_entity)
      expect(JSON.parse(response.body)['error']).to include('template_params')
    end

    it 'devuelve 422 cuando el template no existe' do
      allow_any_instance_of(Whatsapp::TemplateMessageBuilder).to receive(:build)
        .and_raise(Whatsapp::TemplateMessageBuilder::TemplateNotFound, "Template 'x' not found")

      post_send_by_phone

      expect(response).to have_http_status(:unprocessable_entity)
      expect(JSON.parse(response.body)['error']).to include('not found')
    end
  end

  describe 'auth' do
    it 'devuelve 401 sin X-Tenant-Id' do
      post_send_by_phone(valid_payload, custom_headers: headers.except('X-Tenant-Id'))
      expect(response).to have_http_status(:unauthorized)
    end

    it 'devuelve 404 con X-Tenant-Id inexistente' do
      post_send_by_phone(valid_payload, custom_headers: headers.merge('X-Tenant-Id' => '999999999'))
      expect(response).to have_http_status(:not_found)
    end
  end
end

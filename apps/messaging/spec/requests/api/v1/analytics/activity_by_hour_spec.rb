require 'rails_helper'

RSpec.describe 'GET /api/v1/analytics/activity_by_hour', type: :request do
  let(:account)  { create(:account) }
  let(:contact)  { create(:contact, account: account) }
  let(:inbox)    { create(:inbox, account: account) }
  let(:ci)       { create(:contact_inbox, contact: contact, inbox: inbox) }
  let!(:conv)    { create(:conversation, account: account, inbox: inbox, contact: contact, contact_inbox: ci) }

  let(:api_key)  { 'test-messaging-service-api-key-abc123' }
  let(:headers) do
    { 'X-Tenant-Id' => account.ventia_tenant_id.to_s, 'X-API-Key' => api_key }
  end

  before { ENV['MESSAGING_SERVICE_API_KEY'] = api_key }
  after  { ENV.delete('MESSAGING_SERVICE_API_KEY') }

  # Crea un message incoming con created_at UTC explícito.
  def make_message(at_utc:, account: nil)
    target_account = account || self.account
    target_inbox = target_account == self.account ? inbox : create(:inbox, account: target_account)
    target_contact = target_account == self.account ? contact : create(:contact, account: target_account)
    target_conv = target_account == self.account ? conv : create(
      :conversation,
      account: target_account, inbox: target_inbox, contact: target_contact,
      contact_inbox: create(:contact_inbox, contact: target_contact, inbox: target_inbox)
    )
    target_conv.messages.create!(
      account: target_account, inbox: target_inbox, sender: target_contact,
      message_type: :incoming, content: 'hola', created_at: at_utc
    )
  end

  def request_activity(params)
    get '/api/v1/analytics/activity_by_hour', headers: headers, params: params
  end

  describe 'shape de la respuesta' do
    it 'devuelve matrix 7×24 inicializada con ceros cuando no hay mensajes' do
      request_activity(start_date: 7.days.ago.iso8601, end_date: Time.current.iso8601)

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      matrix = body['data']['matrix']
      expect(matrix.size).to eq(7)
      expect(matrix.all? { |row| row.size == 24 }).to be(true)
      expect(matrix.flatten.sum).to eq(0)
      expect(body['data']['max_count']).to eq(0)
    end
  end

  describe 'regresión: AT TIME ZONE con created_at UTC en tz local (America/Lima)' do
    # Lima es UTC-5. Un mensaje a las 20:00 UTC corresponde a las 15:00 Lima.
    # 2026-06-03 es miércoles → DOW=3 en Postgres (Sunday=0).
    let(:fixed_utc) { Time.utc(2026, 6, 3, 20, 0, 0) }

    before { make_message(at_utc: fixed_utc) }

    it 'agrupa el mensaje en miércoles (DOW=3) a las 15h Lima, no jueves a la 1h' do
      request_activity(
        start_date: '2026-06-01T00:00:00Z',
        end_date: '2026-06-05T00:00:00Z',
        timezone: 'America/Lima'
      )

      expect(response).to have_http_status(:ok)
      matrix = JSON.parse(response.body)['data']['matrix']

      expect(matrix[3][15]).to eq(1) # Miércoles 15h Lima — esperado
      expect(matrix[4][1]).to  eq(0) # Jueves 1h — celda donde caía el bug
      expect(matrix.flatten.sum).to eq(1)
    end

    it 'con tz UTC el mismo mensaje aparece en miércoles a las 20h (sin desfase)' do
      request_activity(
        start_date: '2026-06-01T00:00:00Z',
        end_date: '2026-06-05T00:00:00Z',
        timezone: 'UTC'
      )

      matrix = JSON.parse(response.body)['data']['matrix']
      expect(matrix[3][20]).to eq(1) # Miércoles 20h UTC
      expect(matrix.flatten.sum).to eq(1)
    end
  end

  describe 'validación de timezone' do
    it 'retorna 400 cuando la timezone es inválida' do
      request_activity(
        start_date: 1.day.ago.iso8601, end_date: Time.current.iso8601,
        timezone: 'Not/A/Real/Zone'
      )

      expect(response).to have_http_status(:bad_request)
      expect(JSON.parse(response.body)['error']).to match(/timezone/i)
    end

    it 'usa America/Lima por default si no se pasa timezone' do
      make_message(at_utc: Time.utc(2026, 6, 3, 20, 0, 0))
      request_activity(start_date: '2026-06-01T00:00:00Z', end_date: '2026-06-05T00:00:00Z')

      matrix = JSON.parse(response.body)['data']['matrix']
      # Sin tz explícita → default Lima → miércoles 15h
      expect(matrix[3][15]).to eq(1)
    end
  end

  describe 'cross_tenant' do
    let(:other_account) { create(:account, ventia_tenant_id: rand(900_000..999_999)) }

    before do
      make_message(at_utc: Time.utc(2026, 6, 3, 20, 0, 0))                          # del current
      make_message(at_utc: Time.utc(2026, 6, 3, 20, 0, 0), account: other_account)  # de otro tenant
    end

    it 'sin cross_tenant solo cuenta mensajes del current_account' do
      request_activity(start_date: '2026-06-01T00:00:00Z', end_date: '2026-06-05T00:00:00Z', timezone: 'America/Lima')

      matrix = JSON.parse(response.body)['data']['matrix']
      expect(matrix[3][15]).to eq(1)
      expect(matrix.flatten.sum).to eq(1)
    end

    it 'con cross_tenant=true cuenta mensajes de todos los tenants' do
      request_activity(
        start_date: '2026-06-01T00:00:00Z', end_date: '2026-06-05T00:00:00Z',
        timezone: 'America/Lima', cross_tenant: 'true'
      )

      matrix = JSON.parse(response.body)['data']['matrix']
      expect(matrix[3][15]).to eq(2)
      expect(matrix.flatten.sum).to eq(2)
    end
  end

  describe 'rango de fechas' do
    before do
      make_message(at_utc: Time.utc(2026, 6, 3, 20, 0, 0)) # dentro del rango
      make_message(at_utc: Time.utc(2026, 5, 1, 20, 0, 0)) # fuera del rango
    end

    it 'solo incluye mensajes dentro del rango start_date..end_date' do
      request_activity(start_date: '2026-06-01T00:00:00Z', end_date: '2026-06-05T00:00:00Z', timezone: 'America/Lima')

      matrix = JSON.parse(response.body)['data']['matrix']
      expect(matrix.flatten.sum).to eq(1)
      expect(matrix[3][15]).to eq(1)
    end
  end
end

require 'rails_helper'

RSpec.describe 'Api::V1::NotificationSettings', type: :request do
  let(:account) { create(:account, ventia_tenant_id: rand(100_000..999_999)) }
  let(:user) { create(:user, ventia_user_id: rand(100_000..999_999)) }
  let!(:account_user) { AccountUser.create!(account: account, user: user, role: :agent) }
  let(:api_key) { 'test-api-key' }

  let(:headers) do
    {
      'X-Tenant-Id' => account.ventia_tenant_id.to_s,
      'X-User-Id' => user.ventia_user_id.to_s,
      'X-API-Key' => api_key,
      'Content-Type' => 'application/json'
    }
  end

  before { ENV['MESSAGING_SERVICE_API_KEY'] = api_key }
  after { ENV.delete('MESSAGING_SERVICE_API_KEY') }

  describe 'GET /api/v1/notification_settings' do
    it 'returns both push_flags and email_flags' do
      get '/api/v1/notification_settings', headers: headers

      expect(response).to have_http_status(:ok)
      data = response.parsed_body['data']
      expect(data).to have_key('push_flags')
      expect(data).to have_key('email_flags')
    end

    it 'returns correct default values' do
      get '/api/v1/notification_settings', headers: headers

      data = response.parsed_body['data']
      expect(data['email_flags']['human_support']).to be true
      expect(data['email_flags']['payment_review']).to be true
      # human_support y payment_review ahora también están activos en push por defecto.
      expect(data['push_flags']['human_support']).to be true
      expect(data['push_flags']['payment_review']).to be true
      expect(data['push_flags']['message_ai_off']).to be true
    end
  end

  describe 'PUT /api/v1/notification_settings' do
    before do
      get '/api/v1/notification_settings', headers: headers
    end

    context 'con channel explícito' do
      it 'channel=email modifica solo email_flags, no push_flags' do
        put '/api/v1/notification_settings',
          params: { notification_settings: { human_support: false, channel: 'email' } }.to_json,
          headers: headers

        expect(response).to have_http_status(:ok)
        setting = NotificationSetting.find_by(user: user, account: account)
        expect(setting.email_enabled?(:human_support)).to be false
        expect(setting.push_enabled?(:human_support)).to be true
      end

      it 'channel=push modifica solo push_flags, no email_flags' do
        put '/api/v1/notification_settings',
          params: { notification_settings: { human_support: false, channel: 'push' } }.to_json,
          headers: headers

        expect(response).to have_http_status(:ok)
        setting = NotificationSetting.find_by(user: user, account: account)
        expect(setting.push_enabled?(:human_support)).to be false
        expect(setting.email_enabled?(:human_support)).to be true
      end

      it 'channel=email ignora flags sin template de email (message_ai_off)' do
        put '/api/v1/notification_settings',
          params: { notification_settings: { message_ai_off: false, channel: 'email' } }.to_json,
          headers: headers

        expect(response).to have_http_status(:ok)
        setting = NotificationSetting.find_by(user: user, account: account)
        # push de message_ai_off se mantiene intacto porque el canal email no aplica.
        expect(setting.push_enabled?(:message_ai_off)).to be true
      end
    end

    context 'sin channel (compatibilidad legacy por nombre)' do
      it 'rutea human_support a email_flags' do
        put '/api/v1/notification_settings',
          params: { notification_settings: { human_support: false } }.to_json,
          headers: headers

        setting = NotificationSetting.find_by(user: user, account: account)
        expect(setting.email_enabled?(:human_support)).to be false
        expect(setting.push_enabled?(:human_support)).to be true
      end

      it 'rutea message_ai_off a push_flags' do
        put '/api/v1/notification_settings',
          params: { notification_settings: { message_ai_off: false } }.to_json,
          headers: headers

        setting = NotificationSetting.find_by(user: user, account: account)
        expect(setting.push_enabled?(:message_ai_off)).to be false
      end
    end
  end
end

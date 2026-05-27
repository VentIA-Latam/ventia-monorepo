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
      expect(data['push_flags']['human_support']).to be false
      expect(data['push_flags']['message_ai_off']).to be true
    end
  end

  describe 'PUT /api/v1/notification_settings' do
    before do
      get '/api/v1/notification_settings', headers: headers
    end

    it 'updates email flags for human_support' do
      put '/api/v1/notification_settings',
        params: { notification_settings: { human_support: false } }.to_json,
        headers: headers

      expect(response).to have_http_status(:ok)
      data = response.parsed_body['data']
      expect(data['email_flags']['human_support']).to be false
      expect(data['email_flags']['payment_review']).to be true
    end

    it 'updates push flags for message_ai_off' do
      put '/api/v1/notification_settings',
        params: { notification_settings: { message_ai_off: false } }.to_json,
        headers: headers

      expect(response).to have_http_status(:ok)
      data = response.parsed_body['data']
      expect(data['push_flags']['message_ai_off']).to be false
    end

    it 'routes human_support to email_flags not push_flags' do
      put '/api/v1/notification_settings',
        params: { notification_settings: { human_support: false } }.to_json,
        headers: headers

      setting = NotificationSetting.find_by(user: user, account: account)
      expect(setting.email_enabled?(:human_support)).to be false
      expect(setting.push_flags).to eq(NotificationSetting::DEFAULT_PUSH_FLAGS)
    end
  end
end

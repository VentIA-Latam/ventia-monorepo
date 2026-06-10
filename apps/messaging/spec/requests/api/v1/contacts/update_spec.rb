require 'rails_helper'

RSpec.describe 'Api::V1::Contacts update', type: :request do
  let(:account)      { create(:account, ventia_tenant_id: rand(100_000..999_999)) }
  let(:user)         { create(:user, ventia_user_id: rand(100_000..999_999)) }
  let!(:account_user) { AccountUser.create!(account: account, user: user, role: :agent) }
  let(:contact)      { create(:contact, account: account) }
  let(:api_key)      { 'test-api-key' }

  let(:headers) do
    {
      'X-Tenant-Id' => account.ventia_tenant_id.to_s,
      'X-User-Id'   => user.ventia_user_id.to_s,
      'X-API-Key'   => api_key,
      'Content-Type' => 'application/json'
    }
  end

  before { ENV['MESSAGING_SERVICE_API_KEY'] = api_key }
  after  { ENV.delete('MESSAGING_SERVICE_API_KEY') }

  describe 'PATCH /api/v1/contacts/:id with birthdate' do
    it 'persists birthdate when valid ISO date is given' do
      patch "/api/v1/contacts/#{contact.id}",
            params: { contact: { birthdate: '1995-03-12' } }.to_json,
            headers: headers

      expect(response).to have_http_status(:ok)
      expect(contact.reload.birthdate).to eq(Date.new(1995, 3, 12))
      data = response.parsed_body['data']
      expect(data['birthdate']).to eq('1995-03-12')
    end

    it 'rejects future birthdate with 422' do
      patch "/api/v1/contacts/#{contact.id}",
            params: { contact: { birthdate: '2099-01-01' } }.to_json,
            headers: headers

      expect(response).to have_http_status(:unprocessable_content).or have_http_status(:unprocessable_entity)
      expect(response.parsed_body['success']).to be false
    end

    it 'clears birthdate when nil is sent' do
      contact.update!(birthdate: Date.new(1995, 3, 12))

      patch "/api/v1/contacts/#{contact.id}",
            params: { contact: { birthdate: nil } }.to_json,
            headers: headers

      expect(response).to have_http_status(:ok)
      expect(contact.reload.birthdate).to be_nil
      data = response.parsed_body['data']
      expect(data['birthdate']).to be_nil
    end

    it 'returns birthdate in ISO format on contact_json' do
      contact.update!(birthdate: Date.new(1995, 3, 12))

      patch "/api/v1/contacts/#{contact.id}",
            params: { contact: { name: contact.name } }.to_json,
            headers: headers

      data = response.parsed_body['data']
      expect(data['birthdate']).to eq('1995-03-12')
    end
  end
end

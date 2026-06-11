require 'rails_helper'

RSpec.describe 'Api::V1::Contacts::Notes', type: :request do
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

  describe 'GET /api/v1/contacts/:contact_id/notes' do
    it 'returns notes in recent_first order' do
      old_note = Note.create!(account: account, contact: contact, user: user, content: 'old', created_at: 2.days.ago)
      new_note = Note.create!(account: account, contact: contact, user: user, content: 'new', created_at: 1.minute.ago)

      get "/api/v1/contacts/#{contact.id}/notes", headers: headers

      expect(response).to have_http_status(:ok)
      data = response.parsed_body['data']
      expect(data.map { |n| n['id'] }).to eq([new_note.id, old_note.id])
    end

    it 'includes user data when user present' do
      Note.create!(account: account, contact: contact, user: user, content: 'with user')

      get "/api/v1/contacts/#{contact.id}/notes", headers: headers

      data = response.parsed_body['data']
      expect(data.first['user']).to include('id' => user.id, 'name' => user.name, 'email' => user.email)
    end

    it 'returns user: nil when user_id is null' do
      Note.create!(account: account, contact: contact, user: nil, content: 'orphan')

      get "/api/v1/contacts/#{contact.id}/notes", headers: headers

      data = response.parsed_body['data']
      expect(data.first['user']).to be_nil
    end

    it 'returns 404 for contact of another account' do
      other_account = create(:account, ventia_tenant_id: rand(100_000..999_999))
      other_contact = create(:contact, account: other_account)

      get "/api/v1/contacts/#{other_contact.id}/notes", headers: headers

      expect(response).to have_http_status(:not_found)
    end
  end

  describe 'POST /api/v1/contacts/:contact_id/notes' do
    it 'creates a note with current_user as author' do
      expect do
        post "/api/v1/contacts/#{contact.id}/notes",
             params: { note: { content: 'Cliente VIP' } }.to_json,
             headers: headers
      end.to change(Note, :count).by(1)

      expect(response).to have_http_status(:created)
      data = response.parsed_body['data']
      expect(data['content']).to eq('Cliente VIP')
      expect(data['user']['id']).to eq(user.id)
    end

    it 'returns 422 when content is blank' do
      post "/api/v1/contacts/#{contact.id}/notes",
           params: { note: { content: '' } }.to_json,
           headers: headers

      expect(response).to have_http_status(:unprocessable_content).or have_http_status(:unprocessable_entity)
      expect(response.parsed_body['success']).to be false
    end

    it 'rejects content exceeding max length' do
      post "/api/v1/contacts/#{contact.id}/notes",
           params: { note: { content: 'x' * (Note::CONTENT_MAX_LENGTH + 1) } }.to_json,
           headers: headers

      expect(response).to have_http_status(:unprocessable_content).or have_http_status(:unprocessable_entity)
    end
  end

  describe 'PATCH /api/v1/contacts/:contact_id/notes/:id' do
    let!(:note) { Note.create!(account: account, contact: contact, user: user, content: 'original') }

    it 'updates note content' do
      patch "/api/v1/contacts/#{contact.id}/notes/#{note.id}",
            params: { note: { content: 'updated' } }.to_json,
            headers: headers

      expect(response).to have_http_status(:ok)
      expect(note.reload.content).to eq('updated')
    end

    it 'returns 404 for note belonging to another contact' do
      other_contact = create(:contact, account: account)
      other_note = Note.create!(account: account, contact: other_contact, user: user, content: 'other')

      patch "/api/v1/contacts/#{contact.id}/notes/#{other_note.id}",
            params: { note: { content: 'hack' } }.to_json,
            headers: headers

      expect(response).to have_http_status(:not_found)
    end
  end

  describe 'DELETE /api/v1/contacts/:contact_id/notes/:id' do
    let!(:note) { Note.create!(account: account, contact: contact, user: user, content: 'to delete') }

    it 'deletes the note' do
      expect do
        delete "/api/v1/contacts/#{contact.id}/notes/#{note.id}", headers: headers
      end.to change(Note, :count).by(-1)

      expect(response).to have_http_status(:ok)
    end

    it 'returns 404 for note of another tenant contact' do
      other_account = create(:account, ventia_tenant_id: rand(100_000..999_999))
      other_contact = create(:contact, account: other_account)
      other_note = Note.create!(account: other_account, contact: other_contact, user: user, content: 'other tenant')

      delete "/api/v1/contacts/#{other_contact.id}/notes/#{other_note.id}", headers: headers

      expect(response).to have_http_status(:not_found)
    end
  end
end

require 'rails_helper'

RSpec.describe 'POST /api/v1/conversations/:id/messages (cards / carrusel)', type: :request do
  let(:account)    { create(:account) }
  let(:ig_channel) { create(:channel_instagram, account: account) }
  let(:ig_inbox)   { create(:inbox, account: account, channel: ig_channel) }
  let(:wa_inbox)   { create(:inbox, account: account) } # factory default: channel_whatsapp

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

  let(:cards) do
    [{
      'title' => 'Zapatillas Runner',
      'image_url' => 'https://img/shoe.jpg',
      'buttons' => [{ 'type' => 'web_url', 'title' => 'Ver', 'url' => 'https://t/p' }]
    }]
  end

  def conversation_for(inbox)
    contact = create(:contact, account: account)
    ci = create(:contact_inbox, contact: contact, inbox: inbox, source_id: 'SRC_X')
    create(:conversation, account: account, inbox: inbox, contact: contact, contact_inbox: ci)
  end

  def post_cards(conversation, body_cards: cards)
    post "/api/v1/conversations/#{conversation.id}/messages",
         params: { message: { content_type: 'cards', content_attributes: { cards: body_cards } } }.to_json,
         headers: headers
  end

  it 'creates the message on an Instagram conversation' do
    conv = conversation_for(ig_inbox)
    post_cards(conv)

    expect(response).to have_http_status(:created).or have_http_status(:ok)
    expect(conv.messages.count).to eq(1)
    expect(conv.messages.last.content_type).to eq('cards')
  end

  it 'rejects cards on a non-Instagram (WhatsApp) conversation with 422' do
    conv = conversation_for(wa_inbox)
    post_cards(conv)

    expect(response).to have_http_status(:unprocessable_entity)
    expect(conv.messages.count).to eq(0)
  end

  it 'rejects an empty cards array with 422 even on Instagram' do
    conv = conversation_for(ig_inbox)
    post_cards(conv, body_cards: [])

    expect(response).to have_http_status(:unprocessable_entity)
    expect(conv.messages.count).to eq(0)
  end
end

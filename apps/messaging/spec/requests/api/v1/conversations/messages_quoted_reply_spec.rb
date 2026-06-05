require 'rails_helper'

# US-UX-002: Reply a mensajes específicos (quoted message).
# El frontend manda content_attributes.in_reply_to (el source_id/wamid del mensaje citado)
# y necesita recibir source_id de vuelta en cada mensaje para resolver el bubble citado.
RSpec.describe 'POST/GET /api/v1/conversations/:id/messages (quoted reply)', type: :request do
  let(:account) { create(:account) }
  let(:inbox)   { create(:inbox, account: account) } # factory default: channel_whatsapp

  let(:api_key) { 'test-messaging-service-api-key-abc123' }
  let(:headers) do
    {
      'X-Tenant-Id'  => account.ventia_tenant_id.to_s,
      'X-API-Key'    => api_key,
      'Content-Type' => 'application/json'
    }
  end

  # `around` con restore explícito del valor previo en vez de `before/after` que
  # asume el ENV vacío al inicio. Si otro spec corre con un value distinto en el
  # mismo proceso (poco común pero posible bajo `rspec --order=random` con
  # SimpleCov u otros wrappers), no nos pisamos.
  around do |example|
    original = ENV['MESSAGING_SERVICE_API_KEY']
    ENV['MESSAGING_SERVICE_API_KEY'] = api_key
    begin
      example.run
    ensure
      if original.nil?
        ENV.delete('MESSAGING_SERVICE_API_KEY')
      else
        ENV['MESSAGING_SERVICE_API_KEY'] = original
      end
    end
  end

  def conversation_for(target_inbox)
    contact = create(:contact, account: account)
    ci = create(:contact_inbox, contact: contact, inbox: target_inbox, source_id: 'SRC_X')
    create(:conversation, account: account, inbox: target_inbox, contact: contact, contact_inbox: ci)
  end

  it 'persists content_attributes.in_reply_to on the created message' do
    conv = conversation_for(inbox)

    post "/api/v1/conversations/#{conv.id}/messages",
         params: { message: { content: 'Sí, confirmo', content_attributes: { in_reply_to: 'wamid.ORIGINAL' } } }.to_json,
         headers: headers

    expect(response).to have_http_status(:created).or have_http_status(:ok)
    expect(conv.messages.last.content_attributes['in_reply_to']).to eq('wamid.ORIGINAL')
    expect(conv.messages.last.in_reply_to).to eq('wamid.ORIGINAL')
  end

  it 'exposes source_id in the message JSON so the frontend can resolve quoted bubbles' do
    conv = conversation_for(inbox)
    conv.messages.create!(
      account: account,
      inbox: inbox,
      message_type: :incoming,
      content: 'Mensaje original del cliente',
      source_id: 'wamid.ORIGINAL'
    )

    get "/api/v1/conversations/#{conv.id}/messages", headers: headers

    expect(response).to have_http_status(:ok)
    body = JSON.parse(response.body)
    expect(body['data'].first).to have_key('source_id')
    expect(body['data'].first['source_id']).to eq('wamid.ORIGINAL')
  end

  it 'embeds a quoted snapshot of the replied-to message (resolves even if not in the loaded window)' do
    conv = conversation_for(inbox)
    original = conv.messages.create!(
      account: account, inbox: inbox, message_type: :incoming,
      content: 'Mensaje original del cliente', source_id: 'wamid.ORIGINAL'
    )
    conv.messages.create!(
      account: account, inbox: inbox, message_type: :outgoing,
      content: 'Te respondo a eso', content_attributes: { 'in_reply_to' => 'wamid.ORIGINAL' }
    )

    get "/api/v1/conversations/#{conv.id}/messages", headers: headers

    reply = JSON.parse(response.body)['data'].find { |m| m['content'] == 'Te respondo a eso' }
    quoted = reply.dig('content_attributes', 'quoted')
    expect(quoted).to be_present
    expect(quoted['id']).to eq(original.id)
    expect(quoted['content']).to eq('Mensaje original del cliente')
    expect(quoted['message_type']).to eq('incoming')
  end

  it 'omits the quoted snapshot when in_reply_to points to a non-existent wamid (gracefully degrades)' do
    conv = conversation_for(inbox)
    conv.messages.create!(
      account: account, inbox: inbox, message_type: :outgoing,
      content: 'Respondo a algo borrado',
      content_attributes: { 'in_reply_to' => 'wamid.DOES_NOT_EXIST' }
    )

    get "/api/v1/conversations/#{conv.id}/messages", headers: headers

    expect(response).to have_http_status(:ok)
    reply = JSON.parse(response.body)['data'].first
    # `in_reply_to` queda en content_attributes (no perdemos la intención del usuario),
    # pero el `quoted` snapshot no aparece — el frontend cae al fallback "Mensaje original
    # no disponible" sin crashear.
    expect(reply.dig('content_attributes', 'in_reply_to')).to eq('wamid.DOES_NOT_EXIST')
    expect(reply.dig('content_attributes', 'quoted')).to be_nil
  end

  it 'snapshot of a content-less original returns the structural id/message_type minimum' do
    # Cubre el shape para mensajes "vacíos" (media-only sin attachment cargado
    # en test, deleted body, etc.). `compact` en build_quoted_snapshot remueve
    # las keys con nil, así que el frontend debe defenderse de ausencia, no
    # de `null`. Documentamos ese contrato acá.
    conv = conversation_for(inbox)
    conv.messages.create!(
      account: account, inbox: inbox, message_type: :incoming,
      content: nil, source_id: 'wamid.NO_CONTENT'
    )
    conv.messages.create!(
      account: account, inbox: inbox, message_type: :outgoing,
      content: 'Te respondo a eso',
      content_attributes: { 'in_reply_to' => 'wamid.NO_CONTENT' }
    )

    get "/api/v1/conversations/#{conv.id}/messages", headers: headers

    reply = JSON.parse(response.body)['data'].find { |m| m['content'] == 'Te respondo a eso' }
    quoted = reply.dig('content_attributes', 'quoted')
    expect(quoted).to be_present
    expect(quoted['id']).to be_present
    expect(quoted['message_type']).to eq('incoming')
    expect(quoted).not_to have_key('content') # compact remueve nil
  end
end

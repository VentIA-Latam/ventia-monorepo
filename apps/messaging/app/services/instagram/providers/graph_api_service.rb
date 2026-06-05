# Sends outgoing messages to Instagram via the Instagram Graph API.
# Endpoint: POST https://graph.instagram.com/<version>/<instagram_id>/messages
class Instagram::Providers::GraphApiService
  API_BASE_URL = 'https://graph.instagram.com'.freeze

  ATTACHMENT_TYPES = {
    'image' => 'image',
    'audio' => 'audio',
    'video' => 'video',
    'file'  => 'file'
  }.freeze

  # Generic template (carousel) limits, per Meta docs. Enforced defensively to avoid 400s.
  MAX_ELEMENTS = 10
  MAX_BUTTONS = 3
  TEXT_LIMIT = 80       # title / subtitle
  BUTTON_TITLE_LIMIT = 20

  def initialize(instagram_channel:)
    @instagram_channel = instagram_channel
  end

  # Sends attachments first, then text (parity with Chatwoot). source_id is set
  # inside process_response on each successful send.
  def send_message(recipient_id, message)
    @recipient_id = recipient_id

    if message.content_type == 'cards'
      send_cards(message)
      return
    end

    send_attachments(message) if message.attachments.present?
    send_text(message) if message.content.present?
  end

  private

  # --- Carousel (generic template) ---

  def send_cards(message)
    elements = build_elements(message.content_attributes&.dig('cards'))
    if elements.empty?
      message.update!(status: :failed, external_error: 'No hay tarjetas válidas para el carrusel')
      return
    end

    deliver(cards_payload(elements), message)
  end

  def cards_payload(elements)
    {
      recipient: { id: @recipient_id },
      message: {
        attachment: {
          type: 'template',
          payload: { template_type: 'generic', elements: elements }
        }
      }
    }
  end

  # Drop invalid entries first, then cap — so an invalid card/button never "uses up" a slot.
  def build_elements(cards)
    Array(cards).filter_map { |card| build_element(card) }.first(MAX_ELEMENTS)
  end

  def build_element(card)
    title = truncate(card['title'], TEXT_LIMIT)
    return nil if title.blank?

    element = { title: title }
    subtitle = truncate(card['subtitle'], TEXT_LIMIT)
    element[:subtitle] = subtitle if subtitle.present?
    element[:image_url] = card['image_url'] if card['image_url'].present?
    element[:default_action] = { type: 'web_url', url: card['default_action_url'] } if card['default_action_url'].present?

    buttons = build_buttons(card['buttons'])
    element[:buttons] = buttons if buttons.present?

    element
  end

  def build_buttons(buttons)
    Array(buttons).filter_map { |btn| build_button(btn) }.first(MAX_BUTTONS)
  end

  def build_button(btn)
    title = truncate(btn['title'], BUTTON_TITLE_LIMIT)
    return nil if title.blank?

    case btn['type']
    when 'web_url'
      btn['url'].present? ? { type: 'web_url', title: title, url: btn['url'] } : nil
    when 'postback'
      btn['payload'].present? ? { type: 'postback', title: title, payload: btn['payload'] } : nil
    end
  end

  def truncate(text, limit)
    return nil if text.blank?

    text.to_s.strip.first(limit)
  end

  # --- Text & attachments ---

  def send_attachments(message)
    message.attachments.each { |attachment| deliver(attachment_payload(attachment), message) }
  end

  def send_text(message)
    deliver(text_payload(message), message)
  end

  def text_payload(message)
    {
      recipient: { id: @recipient_id },
      message: { text: message.content }
    }
  end

  def attachment_payload(attachment)
    {
      recipient: { id: @recipient_id },
      message: {
        attachment: {
          type: ATTACHMENT_TYPES.fetch(attachment.file_type, 'file'),
          payload: { url: attachment.download_url }
        }
      }
    }
  end

  def deliver(request_body, message)
    response = HTTParty.post(
      "#{API_BASE_URL}/#{api_version}/#{@instagram_channel.instagram_id}/messages",
      headers: api_headers,
      body: request_body.to_json
    )
    process_response(response, message)
  end

  def api_headers
    {
      'Authorization' => "Bearer #{@instagram_channel.valid_access_token}",
      'Content-Type' => 'application/json'
    }
  end

  def api_version
    ENV.fetch('INSTAGRAM_API_VERSION', 'v22.0')
  end

  def process_response(response, message)
    parsed = response.parsed_response
    if response.success? && (!parsed.is_a?(Hash) || parsed['error'].blank?)
      message.update!(source_id: parsed['message_id']) if parsed.is_a?(Hash) && parsed['message_id'].present?
      parsed
    else
      error = parsed.is_a?(Hash) ? parsed['error'] : nil
      @instagram_channel.authorization_error! if error && error['code'] == 190
      message.update!(status: :failed, external_error: error&.dig('message') || response.body)
      nil
    end
  end
end

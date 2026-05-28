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

  def initialize(instagram_channel:)
    @instagram_channel = instagram_channel
  end

  # Sends attachments first, then text (parity with Chatwoot). source_id is set
  # inside process_response on each successful send.
  def send_message(recipient_id, message)
    @recipient_id = recipient_id
    send_attachments(message) if message.attachments.present?
    send_text(message) if message.content.present?
  end

  private

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

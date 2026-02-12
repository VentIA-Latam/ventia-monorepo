class Whatsapp::Providers::BaseService
  attr_reader :whatsapp_channel

  def initialize(whatsapp_channel:)
    @whatsapp_channel = whatsapp_channel
  end

  def send_message(_phone_number, _message)
    raise NotImplementedError, 'Implement send_message in subclass'
  end

  def send_template(_phone_number, _template_info, _message)
    raise NotImplementedError, 'Implement send_template in subclass'
  end

  def sync_templates
    raise NotImplementedError, 'Implement sync_templates in subclass'
  end

  def validate_provider_config?
    raise NotImplementedError, 'Implement validate_provider_config? in subclass'
  end

  def media_url(_media_id)
    raise NotImplementedError, 'Implement media_url in subclass'
  end

  def api_headers
    raise NotImplementedError, 'Implement api_headers in subclass'
  end

  def download_media(_media_id)
    raise NotImplementedError, 'Implement download_media in subclass'
  end

  private

  def process_response(response, message)
    parsed_response = response.parsed_response

    if response.success? && parsed_response['error'].blank?
      parsed_response['messages']&.first&.dig('id')
    else
      handle_error(response, message)
      nil
    end
  end

  def handle_error(response, message)
    Rails.logger.error "[WhatsApp] Error: #{response.body}"
    return if message.blank?

    error_msg = error_message(response)
    return if error_msg.blank?

    message.update!(
      external_error: error_msg,
      status: :failed
    )
  end

  def error_message(response)
    response.parsed_response&.dig('error', 'message')
  end

  def whatsapp_reply_context(message)
    return unless message.in_reply_to

    {
      message_id: message.in_reply_to
    }
  end

  # Interactive message helpers

  def create_payload_based_on_items(message)
    items = message.content_attributes['items']
    return {} if items.blank?

    if items.length <= 3
      create_button_payload(message, items)
    else
      create_list_payload(message, items)
    end
  end

  def create_button_payload(message, items)
    {
      type: 'button',
      body: { text: message.content },
      action: {
        buttons: items.map do |item|
          { type: 'reply', reply: { id: item['value'], title: item['title'] } }
        end
      }
    }
  end

  def create_list_payload(message, items)
    {
      type: 'list',
      body: { text: message.content },
      action: {
        button: 'Options',
        sections: [{
          rows: items.map do |item|
            { id: item['value'], title: item['title'] }
          end
        }]
      }
    }
  end
end

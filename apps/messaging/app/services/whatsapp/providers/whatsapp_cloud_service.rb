class Whatsapp::Providers::WhatsappCloudService < Whatsapp::Providers::BaseService
  API_BASE_URL = ENV.fetch('WHATSAPP_CLOUD_BASE_URL', 'https://graph.facebook.com')
  API_VERSION = 'v13.0'

  def send_message(phone_number, message)
    if message.content_type == 'text'
      send_text_message(phone_number, message)
    else
      send_text_message(phone_number, message) # Fallback to text for now
    end
  end

  def send_template(phone_number, template_info, message)
    template_body = build_template_body(template_info)

    request_body = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: phone_number,
      type: 'template',
      template: template_body
    }

    response = HTTParty.post(
      "#{phone_id_path}/messages",
      headers: api_headers,
      body: request_body.to_json
    )

    process_response(response, message)
  end

  def sync_templates
    # Mark as updated first to prevent infinite retries on error
    whatsapp_channel.mark_message_templates_updated

    url = "#{business_account_path}/message_templates"
    templates = fetch_whatsapp_templates(url)

    if templates.present?
      whatsapp_channel.update(
        message_templates: templates,
        message_templates_last_updated: Time.current
      )
    end
  rescue StandardError => e
    Rails.logger.error "[WhatsApp] Template sync failed: #{e.message}"
  end

  def validate_provider_config?
    url = "#{business_account_path}/message_templates"
    response = HTTParty.get(url, headers: api_headers)
    response.success?
  rescue StandardError
    false
  end

  def api_headers
    {
      'Authorization' => "Bearer #{api_key}",
      'Content-Type' => 'application/json'
    }
  end

  def media_url(media_id)
    "#{API_BASE_URL}/#{API_VERSION}/#{media_id}"
  end

  private

  def api_key
    whatsapp_channel.provider_config['api_key']
  end

  def phone_number_id
    whatsapp_channel.provider_config['phone_number_id']
  end

  def business_account_id
    whatsapp_channel.provider_config['business_account_id']
  end

  def phone_id_path
    "#{API_BASE_URL}/#{API_VERSION}/#{phone_number_id}"
  end

  def business_account_path
    "#{API_BASE_URL}/v14.0/#{business_account_id}"
  end

  def send_text_message(phone_number, message)
    request_body = {
      messaging_product: 'whatsapp',
      to: phone_number,
      type: 'text',
      text: { body: message.content }
    }

    # Add context for replies
    if message.content_attributes['in_reply_to'].present?
      request_body[:context] = {
        message_id: message.content_attributes['in_reply_to']
      }
    end

    response = HTTParty.post(
      "#{phone_id_path}/messages",
      headers: api_headers,
      body: request_body.to_json
    )

    process_response(response, message)
  end

  def build_template_body(template_info)
    body = {
      name: template_info[:name],
      language: {
        policy: 'deterministic',
        code: template_info[:lang_code] || 'en'
      }
    }

    # Add parameters if present
    if template_info[:parameters].present?
      body[:components] = [
        {
          type: 'body',
          parameters: template_info[:parameters].map { |param| { type: 'text', text: param } }
        }
      ]
    end

    body
  end

  def fetch_whatsapp_templates(url)
    response = HTTParty.get(url, headers: api_headers)
    return [] unless response.success?

    templates = response['data'] || []

    # Handle pagination
    next_url = response.dig('paging', 'next')
    if next_url.present?
      templates += fetch_whatsapp_templates(next_url)
    end

    templates
  end
end

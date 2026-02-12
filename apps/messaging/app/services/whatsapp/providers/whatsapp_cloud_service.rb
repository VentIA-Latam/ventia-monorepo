class Whatsapp::Providers::WhatsappCloudService < Whatsapp::Providers::BaseService
  API_BASE_URL = ENV.fetch('WHATSAPP_CLOUD_BASE_URL', 'https://graph.facebook.com')

  def send_message(phone_number, message)
    if message.attachments.present?
      send_attachment_message(phone_number, message)
    elsif message.content_attributes&.dig('items').present?
      send_interactive_text_message(phone_number, message)
    else
      send_text_message(phone_number, message)
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
    "#{API_BASE_URL}/#{api_version}/#{media_id}"
  end

  def download_media(media_id)
    url_response = HTTParty.get(media_url(media_id), headers: api_headers)
    return nil unless url_response.success?

    Down.download(url_response.parsed_response['url'], headers: api_headers)
  rescue Down::Error => e
    Rails.logger.error "[WhatsApp] Media download failed: #{e.message}"
    nil
  end

  private

  def api_version
    ENV.fetch('WHATSAPP_API_VERSION', 'v22.0')
  end

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
    "#{API_BASE_URL}/#{api_version}/#{phone_number_id}"
  end

  def business_account_path
    "#{API_BASE_URL}/#{api_version}/#{business_account_id}"
  end

  def send_text_message(phone_number, message)
    request_body = {
      messaging_product: 'whatsapp',
      context: whatsapp_reply_context(message),
      to: phone_number,
      type: 'text',
      text: { body: message.content }
    }.compact

    response = HTTParty.post(
      "#{phone_id_path}/messages",
      headers: api_headers,
      body: request_body.to_json
    )

    process_response(response, message)
  end

  def send_attachment_message(phone_number, message)
    attachment = message.attachments.first
    type = %w[image audio video].include?(attachment.file_type) ? attachment.file_type : 'document'

    type_content = { link: attachment.file_url }
    type_content[:caption] = message.content unless %w[audio sticker].include?(type)
    type_content[:filename] = attachment.file.filename.to_s if type == 'document' && attachment.file.attached?

    request_body = {
      messaging_product: 'whatsapp',
      context: whatsapp_reply_context(message),
      to: phone_number,
      type: type,
      type.to_s => type_content
    }.compact

    response = HTTParty.post(
      "#{phone_id_path}/messages",
      headers: api_headers,
      body: request_body.to_json
    )

    process_response(response, message)
  end

  def send_interactive_text_message(phone_number, message)
    payload = create_payload_based_on_items(message)

    request_body = {
      messaging_product: 'whatsapp',
      to: phone_number,
      type: 'interactive',
      interactive: payload
    }

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

    body[:components] = template_info[:parameters] if template_info[:parameters].present?
    body
  end

  def fetch_whatsapp_templates(url)
    response = HTTParty.get(url, headers: api_headers)
    return [] unless response.success?

    templates = response['data'] || []

    next_url = response.dig('paging', 'next')
    templates += fetch_whatsapp_templates(next_url) if next_url.present?

    templates
  end
end

class Whatsapp::WebhookTeardownService
  def initialize(whatsapp_channel)
    @whatsapp_channel = whatsapp_channel
  end

  def perform
    business_account_id = @whatsapp_channel.provider_config['business_account_id']
    api_key = @whatsapp_channel.provider_config['api_key']

    return unless business_account_id.present? && api_key.present?

    response = HTTParty.delete(
      "https://graph.facebook.com/v13.0/#{business_account_id}/subscribed_apps",
      headers: {
        'Authorization' => "Bearer #{api_key}",
        'Content-Type' => 'application/json'
      }
    )

    if response.success?
      Rails.logger.info "[WhatsApp] Webhook teardown successful for #{@whatsapp_channel.phone_number}"
    else
      Rails.logger.warn "[WhatsApp] Webhook teardown failed: #{response.body}"
    end
  rescue StandardError => e
    Rails.logger.error "[WhatsApp] Webhook teardown error: #{e.message}"
  end
end

class Whatsapp::WebhookSetupService
  WEBHOOK_EVENTS = %w[messages message_template_status_update].freeze

  def initialize(whatsapp_channel, business_account_id, api_key)
    @whatsapp_channel = whatsapp_channel
    @business_account_id = business_account_id
    @api_key = api_key
  end

  def perform
    callback_url = webhook_callback_url
    verify_token = @whatsapp_channel.provider_config['webhook_verify_token']

    response = HTTParty.post(
      "https://graph.facebook.com/v13.0/#{@business_account_id}/subscribed_apps",
      headers: {
        'Authorization' => "Bearer #{@api_key}",
        'Content-Type' => 'application/json'
      },
      body: {
        override_callback_url: callback_url,
        verify_token: verify_token
      }.to_json
    )

    if response.success?
      Rails.logger.info "[WhatsApp] Webhook setup successful for #{@whatsapp_channel.phone_number}"
      true
    else
      Rails.logger.error "[WhatsApp] Webhook setup failed: #{response.body}"
      false
    end
  rescue StandardError => e
    Rails.logger.error "[WhatsApp] Webhook setup error: #{e.message}"
    false
  end

  private

  def webhook_callback_url
    inbox = @whatsapp_channel.inbox
    return unless inbox

    # This should point to your messaging service webhook endpoint
    # Format: https://your-domain.com/api/v1/whatsapp/webhooks/:inbox_id
    base_url = ENV.fetch('MESSAGING_SERVICE_URL', 'http://localhost:3001')
    "#{base_url}/api/v1/whatsapp/webhooks/#{inbox.id}"
  end
end

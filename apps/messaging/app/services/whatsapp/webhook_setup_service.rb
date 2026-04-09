class Whatsapp::WebhookSetupService
  def initialize(channel, business_account_id, api_key)
    @channel = channel
    @business_account_id = business_account_id
    @api_key = api_key
    @api_client = Whatsapp::FacebookApiClient.new(api_key)
  end

  def perform
    validate_parameters!

    register_phone_number unless phone_number_verified?
    setup_webhook
  end

  private

  def validate_parameters!
    raise ArgumentError, 'Channel is required' if @channel.blank?
    raise ArgumentError, 'WABA ID is required' if @business_account_id.blank?
    raise ArgumentError, 'Access token is required' if @api_key.blank?
  end

  def register_phone_number
    phone_number_id = @channel.provider_config['phone_number_id']
    pin = fetch_or_create_pin

    @api_client.register_phone_number(phone_number_id, pin)
    store_pin(pin)
  rescue StandardError => e
    Rails.logger.warn("[WHATSAPP] Phone registration failed but continuing: #{e.message}")
  end

  def fetch_or_create_pin
    existing_pin = @channel.provider_config['verification_pin']
    return existing_pin.to_i if existing_pin.present?

    SecureRandom.random_number(900_000) + 100_000
  end

  def store_pin(pin)
    @channel.provider_config['verification_pin'] = pin
    @channel.save!
  end

  def setup_webhook
    callback_url = build_callback_url
    verify_token = @channel.provider_config['webhook_verify_token']

    @api_client.subscribe_waba_webhook(@business_account_id, callback_url, verify_token)
  rescue StandardError => e
    Rails.logger.error("[WHATSAPP] Webhook setup failed: #{e.message}")
    raise "Webhook setup failed: #{e.message}"
  end

  def build_callback_url
    base_url = ENV.fetch('MESSAGING_SERVICE_URL', 'http://localhost:3001')
    phone_number = @channel.phone_number
    "#{base_url}/webhooks/whatsapp/#{phone_number}"
  end

  def phone_number_verified?
    phone_number_id = @channel.provider_config['phone_number_id']
    @api_client.phone_number_verified?(phone_number_id)
  rescue StandardError => e
    Rails.logger.error("[WHATSAPP] Phone verification status check failed: #{e.message}")
    false
  end
end

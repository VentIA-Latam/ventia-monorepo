class Whatsapp::EmbeddedSignupService
  FB_APP_ID = ENV.fetch('FACEBOOK_APP_ID', '')
  FB_APP_SECRET = ENV.fetch('FACEBOOK_APP_SECRET', '')

  def initialize(account:, params:)
    @account = account
    @code = params[:code]
    @business_id = params[:business_id]
    @waba_id = params[:waba_id]
    @phone_number_id = params[:phone_number_id]
  end

  def perform
    validate_parameters!

    # Step 1: Exchange authorization code for access token
    access_token = exchange_code_for_token

    # Step 2: Fetch phone number and business information
    phone_info = fetch_phone_info(access_token)

    # Step 3: Create WhatsApp channel and inbox
    channel = create_channel(access_token, phone_info)

    # Step 4: Set up Meta webhooks
    channel.setup_webhooks

    channel
  rescue StandardError => e
    Rails.logger.error "[WhatsApp] Embedded signup failed: #{e.message}"
    raise
  end

  private

  def validate_parameters!
    missing = []
    missing << 'code' if @code.blank?
    missing << 'business_id' if @business_id.blank?
    missing << 'waba_id' if @waba_id.blank?
    missing << 'phone_number_id' if @phone_number_id.blank?

    raise ArgumentError, "Missing parameters: #{missing.join(', ')}" if missing.any?
  end

  def exchange_code_for_token
    response = HTTParty.post(
      'https://graph.facebook.com/v13.0/oauth/access_token',
      body: {
        client_id: FB_APP_ID,
        client_secret: FB_APP_SECRET,
        code: @code
      }
    )

    unless response.success?
      raise "Token exchange failed: #{response.body}"
    end

    response['access_token']
  end

  def fetch_phone_info(access_token)
    response = HTTParty.get(
      "https://graph.facebook.com/v13.0/#{@phone_number_id}",
      query: {
        access_token: access_token,
        fields: 'verified_name,display_phone_number,quality_rating'
      }
    )

    unless response.success?
      raise "Failed to fetch phone info: #{response.body}"
    end

    {
      phone_number: response['display_phone_number'],
      verified_name: response['verified_name'],
      quality_rating: response['quality_rating']
    }
  end

  def create_channel(access_token, phone_info)
    # Create WhatsApp channel
    whatsapp_channel = Channel::Whatsapp.create!(
      account: @account,
      phone_number: phone_info[:phone_number],
      provider: 'whatsapp_cloud',
      provider_config: {
        'api_key' => access_token,
        'phone_number_id' => @phone_number_id,
        'business_account_id' => @waba_id,
        'source' => 'embedded_signup'
      }
    )

    # Create associated inbox
    Inbox.create!(
      account: @account,
      name: "WhatsApp: #{phone_info[:verified_name]}",
      channel: whatsapp_channel,
      greeting_message: "Hello! How can we help you today?"
    )

    whatsapp_channel
  end
end

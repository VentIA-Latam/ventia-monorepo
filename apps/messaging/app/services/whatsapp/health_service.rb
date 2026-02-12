class Whatsapp::HealthService
  def initialize(channel)
    @channel = channel
    @access_token = channel.provider_config['api_key']
    @api_version = ENV.fetch('WHATSAPP_API_VERSION', 'v22.0')
  end

  def fetch_health_status
    validate_channel!
    fetch_phone_health_data
  end

  private

  def validate_channel!
    raise ArgumentError, 'Channel is required' if @channel.blank?
    raise ArgumentError, 'API key is missing' if @access_token.blank?
    raise ArgumentError, 'Phone number ID is missing' if @channel.provider_config['phone_number_id'].blank?
  end

  def fetch_phone_health_data
    phone_number_id = @channel.provider_config['phone_number_id']

    response = HTTParty.get(
      "https://graph.facebook.com/#{@api_version}/#{phone_number_id}",
      query: {
        fields: health_fields,
        access_token: @access_token
      }
    )

    handle_response(response)
  rescue StandardError => e
    Rails.logger.error "[WHATSAPP HEALTH] Error fetching health data: #{e.message}"
    raise e
  end

  def health_fields
    %w[
      quality_rating
      messaging_limit_tier
      code_verification_status
      account_mode
      id
      display_phone_number
      name_status
      verified_name
      throughput
      last_onboarded_time
      platform_type
    ].join(',')
  end

  def handle_response(response)
    unless response.success?
      Rails.logger.error "[WHATSAPP HEALTH] API request failed: #{response.code} - #{response.body}"
      raise "WhatsApp API request failed: #{response.code}"
    end

    data = response.parsed_response
    {
      display_phone_number: data['display_phone_number'],
      verified_name: data['verified_name'],
      name_status: data['name_status'],
      quality_rating: data['quality_rating'],
      messaging_limit_tier: data['messaging_limit_tier'],
      account_mode: data['account_mode'],
      code_verification_status: data['code_verification_status'],
      throughput: data['throughput'],
      last_onboarded_time: data['last_onboarded_time'],
      platform_type: data['platform_type'],
      business_id: @channel.provider_config['business_account_id']
    }
  end
end

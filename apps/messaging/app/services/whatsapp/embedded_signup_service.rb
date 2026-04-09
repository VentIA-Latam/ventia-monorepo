class Whatsapp::EmbeddedSignupService
  def initialize(account:, params:, inbox_id: nil)
    @account = account
    @code = params[:code]
    @business_id = params[:business_id]
    @waba_id = params[:waba_id]
    @phone_number_id = params[:phone_number_id]
    @inbox_id = inbox_id
  end

  def perform
    validate_parameters!

    access_token = exchange_code_for_token
    validate_token_access(access_token)
    phone_info = fetch_phone_info(access_token)

    channel = create_channel(access_token, phone_info)
    setup_webhooks(channel)
    channel

  rescue StandardError => e
    Rails.logger.error("[WHATSAPP] Embedded signup failed: #{e.message}")
    raise e
  end

  private

  def exchange_code_for_token
    Whatsapp::TokenExchangeService.new(@code).perform
  end

  def validate_token_access(access_token)
    Whatsapp::TokenValidationService.new(access_token, @waba_id).perform
  end

  def fetch_phone_info(access_token)
    Whatsapp::PhoneInfoService.new(@waba_id, @phone_number_id, access_token).perform
  end

  def create_channel(access_token, phone_info)
    waba_info = { waba_id: @waba_id, business_name: phone_info[:business_name] }
    Whatsapp::ChannelCreationService.new(@account, waba_info, phone_info, access_token).perform
  end

  def setup_webhooks(channel)
    channel.setup_webhooks
  end

  def validate_parameters!
    missing_params = []
    missing_params << 'code' if @code.blank?
    missing_params << 'business_id' if @business_id.blank?
    missing_params << 'waba_id' if @waba_id.blank?

    return if missing_params.empty?

    raise ArgumentError, "Required parameters are missing: #{missing_params.join(', ')}"
  end
end

class Api::V1::Whatsapp::EmbeddedSignupController < Api::V1::BaseController
  def create
    if params[:inbox_id].present?
      perform_reauthorization
    else
      perform_signup
    end
  rescue ArgumentError => e
    render_error(e.message, status: :bad_request)
  rescue StandardError => e
    Rails.logger.error "[WhatsApp] Embedded signup failed: #{e.message}"
    Rails.logger.error e.backtrace.join("\n")
    render_error('Failed to complete WhatsApp signup', status: :unprocessable_entity)
  end

  def status
    channels = current_account.whatsapp_channels.includes(:inbox)

    render_success(
      channels.map do |channel|
        {
          id: channel.id,
          phone_number: channel.phone_number,
          provider: channel.provider,
          inbox_id: channel.inbox&.id,
          inbox_name: channel.inbox&.name,
          templates_count: channel.message_templates&.count || 0,
          last_template_sync: channel.message_templates_last_updated,
          reauthorization_required: channel.reauthorization_required?
        }
      end
    )
  end

  def health
    inbox = current_account.inboxes.find(params[:inbox_id])
    channel = inbox.channel

    raise ArgumentError, 'Not a WhatsApp channel' unless channel.is_a?(Channel::Whatsapp)

    health_data = Whatsapp::HealthService.new(channel).fetch_health_status
    render_success(health_data)
  rescue ArgumentError => e
    render_error(e.message, status: :bad_request)
  rescue StandardError => e
    Rails.logger.error "[WhatsApp] Health check failed: #{e.message}"
    render_error('Failed to fetch health status', status: :unprocessable_entity)
  end

  private

  def perform_signup
    service = Whatsapp::EmbeddedSignupService.new(
      account: current_account,
      params: embedded_signup_params
    )

    channel = service.perform

    render_success(
      {
        channel_id: channel.id,
        phone_number: channel.phone_number,
        inbox_id: channel.inbox.id,
        inbox_name: channel.inbox.name
      },
      message: 'WhatsApp channel connected successfully',
      status: :created
    )
  end

  def perform_reauthorization
    signup_service = Whatsapp::EmbeddedSignupService.new(
      account: current_account,
      params: embedded_signup_params
    )

    # Exchange code + validate token + get phone info (reuse existing services)
    access_token = Whatsapp::TokenExchangeService.new.perform(embedded_signup_params[:code])
    phone_info = Whatsapp::PhoneInfoService.new.perform(
      embedded_signup_params[:waba_id],
      access_token,
      embedded_signup_params[:phone_number_id]
    )

    reauth_service = Whatsapp::ReauthorizationService.new(
      account: current_account,
      inbox_id: params[:inbox_id],
      phone_number_id: embedded_signup_params[:phone_number_id],
      business_id: embedded_signup_params[:waba_id]
    )

    channel = reauth_service.perform(access_token, phone_info)

    render_success(
      {
        channel_id: channel.id,
        phone_number: channel.phone_number,
        inbox_id: channel.inbox.id,
        inbox_name: channel.inbox.name
      },
      message: 'WhatsApp channel reauthorized successfully'
    )
  end

  def embedded_signup_params
    params.permit(:code, :business_id, :waba_id, :phone_number_id)
  end
end

class Api::V1::Whatsapp::EmbeddedSignupController < Api::V1::BaseController
  def create
    service = Whatsapp::EmbeddedSignupService.new(
      account: current_account,
      params: embedded_signup_params,
      inbox_id: params[:inbox_id]
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
          last_template_sync: channel.message_templates_last_updated
        }
      end
    )
  end

  private

  def embedded_signup_params
    params.permit(:code, :business_id, :waba_id, :phone_number_id)
  end
end

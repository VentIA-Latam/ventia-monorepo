class Webhooks::WhatsappController < ActionController::API
  def verify
    if valid_token?(params['hub.verify_token'])
      Rails.logger.info('WhatsApp webhook verified')
      render json: params['hub.challenge']
    else
      render status: :unauthorized, json: { error: 'Error; wrong verify token' }
    end
  end

  def process_payload
    Webhooks::WhatsappEventsJob.perform_later(params.to_unsafe_hash)
    head :ok
  end

  private

  def valid_token?(token)
    channel = Channel::Whatsapp.find_by(phone_number: params[:phone_number])
    return false unless channel

    webhook_verify_token = channel.provider_config['webhook_verify_token']
    return false if webhook_verify_token.blank?

    token == webhook_verify_token
  end
end

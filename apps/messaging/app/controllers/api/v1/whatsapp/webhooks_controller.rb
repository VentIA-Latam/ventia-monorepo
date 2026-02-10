class Api::V1::Whatsapp::WebhooksController < ApplicationController
  skip_before_action :verify_authenticity_token

  # Verification endpoint for Meta webhook setup
  def verify
    mode = params['hub.mode']
    token = params['hub.verify_token']
    challenge = params['hub.challenge']

    inbox = Inbox.find_by(id: params[:inbox_id])

    if mode == 'subscribe' && inbox.present?
      expected_token = inbox.channel.provider_config['webhook_verify_token']

      if token == expected_token
        render plain: challenge, status: :ok
      else
        render plain: 'Forbidden', status: :forbidden
      end
    else
      render plain: 'Not Found', status: :not_found
    end
  end

  # Process incoming WhatsApp webhooks
  def process_payload
    inbox = Inbox.find_by(id: params[:inbox_id])

    unless inbox&.whatsapp?
      render json: { error: 'Invalid inbox' }, status: :not_found
      return
    end

    # Process the webhook asynchronously
    process_webhook(inbox, webhook_params.to_unsafe_h)

    render json: { success: true }, status: :ok
  rescue StandardError => e
    Rails.logger.error "[WhatsApp] Webhook processing failed: #{e.message}"
    render json: { error: 'Processing failed' }, status: :unprocessable_entity
  end

  private

  def process_webhook(inbox, params)
    # Check if this is a message webhook
    return unless params['entry']&.any?

    changes = params['entry'].first['changes']
    return unless changes&.any?

    value = changes.first['value']
    return unless value['messages']&.any?

    # Process incoming message
    Whatsapp::IncomingMessageService.new(
      inbox: inbox,
      params: params
    ).perform
  end

  def webhook_params
    params.permit!
  end
end

class Notifications::SendFcmJob < ApplicationJob
  queue_as :default

  def perform(tokens:, title:, body:, data: {})
    return if tokens.blank? || FCM_CLIENT.nil?

    message_data = data.transform_values(&:to_s)

    tokens.each do |token|
      send_to_token(token, title, body, message_data)
    end
  end

  private

  def send_to_token(token, title, body, data)
    message = {
      'token' => token,
      'notification' => { 'title' => title, 'body' => body },
      'data' => data,
      'webpush' => {
        'notification' => {
          'icon' => '/images/logo-icon.png',
          'tag' => "ventia-#{data['conversation_id'] || 'general'}"
        },
        'fcm_options' => {
          'link' => data['click_action'] || '/dashboard/conversations'
        }
      }
    }

    response = FCM_CLIENT.send_v1(message)
    handle_response(response, token)
  rescue StandardError => e
    Rails.logger.error "[FCM] Error sending to token #{token[0..10]}...: #{e.message}"
  end

  def handle_response(response, token)
    return unless response.is_a?(Hash)

    status = response[:status_code]
    if status == 404 || status == 400
      Rails.logger.info "[FCM] Removing invalid token #{token[0..10]}..."
      PushSubscriptionToken.where(token: token).destroy_all
    elsif status == 200
      Rails.logger.debug "[FCM] Push sent successfully to #{token[0..10]}..."
    else
      Rails.logger.warn "[FCM] Unexpected status #{status} for token #{token[0..10]}..."
    end
  end
end

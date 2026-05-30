class Webhooks::InstagramController < ActionController::API
  def verify
    if valid_verify_token?(params['hub.verify_token'])
      Rails.logger.info('Instagram webhook verified')
      render plain: params['hub.challenge']
    else
      render status: :unauthorized, json: { error: 'Error; wrong verify token' }
    end
  end

  def process_payload
    return head :unauthorized unless valid_signature?

    payload = params.to_unsafe_hash.except('controller', 'action')

    if contains_echo_event?(payload)
      # Delay echo events to avoid a race where the echo is processed before our
      # own outgoing send commits its source_id, which would create a duplicate.
      Webhooks::InstagramEventsJob.set(wait: 2.seconds).perform_later(payload)
    else
      Webhooks::InstagramEventsJob.perform_later(payload)
    end

    head :ok
  end

  private

  def contains_echo_event?(payload)
    entries = payload['entry']
    return false unless entries.is_a?(Array)

    entries.any? do |entry|
      Array(entry['messaging']).any? { |messaging| messaging.dig('message', 'is_echo').present? }
    end
  end

  def valid_verify_token?(token)
    expected = ENV['INSTAGRAM_WEBHOOK_VERIFY_TOKEN']
    return false if expected.blank?

    ActiveSupport::SecurityUtils.secure_compare(token.to_s, expected)
  end

  def valid_signature?
    signature = request.headers['X-Hub-Signature-256']
    return false if signature.blank?

    app_secret = ENV['INSTAGRAM_APP_SECRET']
    return false if app_secret.blank?

    expected = 'sha256=' + OpenSSL::HMAC.hexdigest('sha256', app_secret, request.raw_post)
    ActiveSupport::SecurityUtils.secure_compare(signature, expected)
  end
end

class Webhooks::DeliverJob < ApplicationJob
  queue_as :default

  def perform(webhook_id: nil, url: nil, event_name:, data:)
    # Use either webhook_id or direct URL
    if webhook_id.present?
      webhook = Webhook.find_by(id: webhook_id)
      return unless webhook

      target_url = webhook.url
    else
      target_url = url
    end

    return if target_url.blank?

    # Prepare payload
    payload = {
      event: event_name,
      timestamp: Time.current.iso8601,
      data: data
    }

    # Send webhook
    response = HTTParty.post(
      target_url,
      headers: {
        'Content-Type' => 'application/json',
        'User-Agent' => 'VentIA-Messaging/1.0'
      },
      body: payload.to_json,
      timeout: 10
    )

    if response.success?
      Rails.logger.info "[Webhook] Delivered to #{target_url}: #{event_name}"
    else
      Rails.logger.error "[Webhook] Failed to deliver to #{target_url}: #{response.code}"
    end
  rescue StandardError => e
    Rails.logger.error "[Webhook] Error delivering to #{target_url}: #{e.message}"
    raise # Will trigger retry
  end
end

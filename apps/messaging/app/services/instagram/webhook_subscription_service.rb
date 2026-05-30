# Subscribes the app to an Instagram account's messaging webhooks.
# The app-level callback URL and verify token are configured once in the Meta
# dashboard; this call opts the specific IG account into the subscribed fields.
class Instagram::WebhookSubscriptionService
  GRAPH_BASE = 'https://graph.instagram.com'.freeze
  SUBSCRIBED_FIELDS = 'messages,messaging_seen'.freeze

  def initialize(channel)
    @channel = channel
  end

  def perform
    response = HTTParty.post(
      "#{GRAPH_BASE}/#{api_version}/#{@channel.instagram_id}/subscribed_apps",
      query: {
        subscribed_fields: SUBSCRIBED_FIELDS,
        access_token: @channel.access_token
      }
    )

    unless response.success?
      Rails.logger.error "[Instagram] Webhook subscription failed: #{response.body}"
    end

    response.success?
  end

  private

  def api_version
    ENV.fetch('INSTAGRAM_API_VERSION', 'v22.0')
  end
end

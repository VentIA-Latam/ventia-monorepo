# Lazily refreshes a channel's long-lived token before it expires.
# Instagram long-lived tokens last 60 days and can be refreshed once they are
# at least 24h old and within 10 days of expiry. Mirrors Chatwoot's approach.
class Instagram::RefreshOauthTokenService
  GRAPH_BASE = 'https://graph.instagram.com'.freeze
  REFRESH_WINDOW = 10.days
  MIN_TOKEN_AGE = 24.hours

  def initialize(channel:)
    @channel = channel
  end

  # Returns a valid access token, refreshing if eligible. Returns nil when the
  # token is missing or already expired (fail-fast → surfaces as a 190 on send,
  # which triggers reauthorization).
  def access_token
    return unless token_valid?
    return @channel.access_token unless eligible_for_refresh?

    attempt_refresh
  end

  private

  def token_valid?
    @channel.token_expires_at.present? && @channel.token_expires_at.future?
  end

  def eligible_for_refresh?
    token_old_enough? && @channel.token_expires_at <= REFRESH_WINDOW.from_now
  end

  def token_old_enough?
    @channel.updated_at.present? && @channel.updated_at <= MIN_TOKEN_AGE.ago
  end

  # On any failure (including a concurrent refresh that already rotated the token)
  # keep using the current token instead of flagging reauthorization — this avoids
  # spurious reauth prompts. A genuinely dead token surfaces as a 190 at send time.
  def attempt_refresh
    response = HTTParty.get(
      "#{GRAPH_BASE}/refresh_access_token",
      query: { grant_type: 'ig_refresh_token', access_token: @channel.access_token }
    )
    raise response.body.to_s unless response.success?

    parsed = response.parsed_response
    @channel.update!(
      access_token: parsed['access_token'],
      token_expires_at: Time.current + parsed['expires_in'].to_i.seconds
    )
    @channel.access_token
  rescue StandardError => e
    Rails.logger.error "[Instagram] Token refresh failed: #{e.message}"
    @channel.access_token
  end
end

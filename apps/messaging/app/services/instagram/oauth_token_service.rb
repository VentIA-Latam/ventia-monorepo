# Handles the Instagram Login OAuth token dance:
#   code -> short-lived token -> long-lived token (60 days) + profile.
class Instagram::OauthTokenService
  AUTHORIZE_URL = 'https://www.instagram.com/oauth/authorize'.freeze
  TOKEN_URL     = 'https://api.instagram.com/oauth/access_token'.freeze
  GRAPH_BASE    = 'https://graph.instagram.com'.freeze
  SCOPES        = %w[instagram_business_basic instagram_business_manage_messages].freeze

  class << self
    def authorize_url(state)
      query = {
        client_id: app_id,
        redirect_uri: redirect_uri,
        response_type: 'code',
        scope: SCOPES.join(','),
        state: state
      }
      "#{AUTHORIZE_URL}?#{query.to_query}"
    end

    def redirect_uri
      "#{ENV.fetch('MESSAGING_PUBLIC_URL').chomp('/')}/instagram/callback"
    end

    def app_id
      ENV.fetch('INSTAGRAM_APP_ID')
    end

    def app_secret
      ENV.fetch('INSTAGRAM_APP_SECRET')
    end

    def api_version
      ENV.fetch('INSTAGRAM_API_VERSION', 'v22.0')
    end
  end

  def initialize(code)
    @code = code
  end

  # Returns { access_token:, token_expires_at:, instagram_id:, username:, profile }
  def perform
    short_lived = exchange_code
    long_lived  = exchange_long_lived(short_lived['access_token'])
    profile     = fetch_profile(long_lived['access_token'])

    {
      access_token: long_lived['access_token'],
      token_expires_at: Time.current + long_lived['expires_in'].to_i.seconds,
      instagram_id: (profile['user_id'].presence || profile['id']).to_s,
      username: profile['username'],
      profile: profile
    }
  end

  private

  def exchange_code
    response = HTTParty.post(
      self.class::TOKEN_URL,
      body: {
        client_id: self.class.app_id,
        client_secret: self.class.app_secret,
        grant_type: 'authorization_code',
        redirect_uri: self.class.redirect_uri,
        code: @code
      }
    )
    handle(response, 'Code exchange failed')
  end

  def exchange_long_lived(short_lived_token)
    response = HTTParty.get(
      "#{self.class::GRAPH_BASE}/access_token",
      query: {
        grant_type: 'ig_exchange_token',
        client_id: self.class.app_id,
        client_secret: self.class.app_secret,
        access_token: short_lived_token
      },
      headers: { 'Accept' => 'application/json' }
    )
    handle(response, 'Long-lived token exchange failed')
  end

  def fetch_profile(access_token)
    response = HTTParty.get(
      "#{self.class::GRAPH_BASE}/#{self.class.api_version}/me",
      query: {
        fields: 'id,user_id,username,name,profile_picture_url,account_type',
        access_token: access_token
      },
      headers: { 'Accept' => 'application/json' }
    )
    handle(response, 'Profile fetch failed')
  end

  def handle(response, error_message)
    raise "#{error_message}: #{response.body}" unless response.success?

    response.parsed_response
  end
end

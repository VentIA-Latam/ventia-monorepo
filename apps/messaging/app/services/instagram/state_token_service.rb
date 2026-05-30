# Signs and verifies the OAuth `state` parameter so the public callback can
# trust which account initiated the flow (CSRF protection).
class Instagram::StateTokenService
  EXPIRY = 10.minutes

  class << self
    def encode(account_id)
      payload = {
        account_id: account_id,
        nonce: SecureRandom.hex(8),
        exp: EXPIRY.from_now.to_i
      }
      JWT.encode(payload, secret, 'HS256')
    end

    # Returns the account_id if the token is valid, otherwise nil.
    def decode(token)
      return if token.blank?

      payload, = JWT.decode(token, secret, true, algorithm: 'HS256')
      payload['account_id']
    rescue JWT::DecodeError => e
      Rails.logger.warn "[Instagram] Invalid OAuth state token: #{e.message}"
      nil
    end

    private

    def secret
      ENV.fetch('INSTAGRAM_APP_SECRET')
    end
  end
end

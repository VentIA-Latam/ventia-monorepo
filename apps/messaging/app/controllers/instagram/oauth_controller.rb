# Public OAuth callback for Instagram Login. Meta redirects the user's browser
# here after they authorize. Validates the signed state, completes the token
# exchange, creates the channel and bounces back to the dashboard.
class Instagram::OauthController < ActionController::API
  def callback
    return redirect_with(:error, 'denied') if params[:error].present?

    account = resolve_account(params[:state])
    return redirect_with(:error, 'invalid_state') if account.blank?

    oauth_result = Instagram::OauthTokenService.new(params[:code]).perform
    Instagram::ChannelCreationService.new(account, oauth_result).perform

    redirect_with(:success)
  rescue StandardError => e
    Rails.logger.error "[Instagram] OAuth callback failed: #{e.message}"
    redirect_with(:error, 'connection_failed')
  end

  private

  def resolve_account(state)
    account_id = Instagram::StateTokenService.decode(state)
    return if account_id.blank?

    Account.find_by(id: account_id)
  end

  def redirect_with(status, reason = nil)
    base = "#{ENV.fetch('FRONTEND_URL', 'http://localhost:3000').chomp('/')}/dashboard/channels"
    query = { status: status, channel: 'instagram' }
    query[:reason] = reason if reason
    redirect_to "#{base}?#{query.to_query}", allow_other_host: true
  end
end

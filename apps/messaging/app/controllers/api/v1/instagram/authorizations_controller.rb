class Api::V1::Instagram::AuthorizationsController < Api::V1::BaseController
  # Returns the Instagram authorize URL with a signed state tying the flow to
  # the current account. The frontend opens this URL in a new tab.
  def authorize
    state = ::Instagram::StateTokenService.encode(current_account.id)
    render_success(authorize_url: ::Instagram::OauthTokenService.authorize_url(state))
  end

  def status
    channels = current_account.instagram_channels.includes(:inbox)

    render_success(
      channels.map do |channel|
        {
          id: channel.id,
          instagram_id: channel.instagram_id,
          username: channel.username,
          inbox_id: channel.inbox&.id,
          inbox_name: channel.inbox&.name,
          reauthorization_required: channel.reauthorization_required?
        }
      end
    )
  end
end

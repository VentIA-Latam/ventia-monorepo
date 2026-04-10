class Api::V1::PushSubscriptionTokensController < Api::V1::BaseController
  def create
    user = resolve_user!
    token = current_account.push_subscription_tokens.find_or_initialize_by(
      user_id: user.id,
      token: token_params[:token]
    )
    token.assign_attributes(token_params.merge(user_id: user.id))

    if token.save
      render_success(token.token_data, message: 'Push token registered', status: :created)
    else
      render_error('Failed to register push token', errors: token.errors.full_messages)
    end
  end

  def destroy
    user = resolve_user!
    token = current_account.push_subscription_tokens
              .where(user_id: user.id)
              .find_by(token: params[:token])

    if token
      token.destroy!
      head :no_content
    else
      render_error('Token not found', status: :not_found)
    end
  end

  private

  def resolve_user!
    user = current_account.account_users
             .joins(:user)
             .where(users: { ventia_user_id: request.headers['X-User-Id'] })
             .first&.user
    raise ActiveRecord::RecordNotFound, 'User not found' unless user
    user
  end

  def token_params
    params.require(:push_subscription_token).permit(:token, :platform, device_info: {})
  end
end

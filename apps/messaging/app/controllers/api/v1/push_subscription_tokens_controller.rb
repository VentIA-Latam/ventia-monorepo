class Api::V1::PushSubscriptionTokensController < Api::V1::BaseController
  def create
    token = current_account.push_subscription_tokens.find_or_initialize_by(
      user_id: current_user_id,
      token: token_params[:token]
    )
    token.assign_attributes(token_params.merge(user_id: current_user_id))

    if token.save
      render_success(token.token_data, message: 'Push token registered', status: :created)
    else
      render_error('Failed to register push token', errors: token.errors.full_messages)
    end
  end

  def destroy
    token = current_account.push_subscription_tokens
              .where(user_id: current_user_id)
              .find_by(token: params[:token])

    if token
      token.destroy!
      head :no_content
    else
      render_error('Token not found', status: :not_found)
    end
  end

  private

  def current_user_id
    request.headers['X-User-Id']
  end

  def token_params
    params.require(:push_subscription_token).permit(:token, :platform, device_info: {})
  end
end

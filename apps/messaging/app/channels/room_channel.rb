class RoomChannel < ApplicationCable::Channel
  def subscribed
    current_user
    current_account

    if @current_user.blank? || @current_account.blank?
      reject
      return
    end

    ensure_stream
    update_subscription
    broadcast_presence
  end

  def update_presence
    update_subscription
    broadcast_presence
  end

  def unsubscribed
    # Cleanup when disconnected
  end

  private

  def broadcast_presence
    return if @current_account.blank?

    data = {
      account_id: @current_account.id,
      users: ::OnlineStatusTracker.get_available_users(@current_account.id)
    }

    ActionCable.server.broadcast(pubsub_token, { event: 'presence.update', data: data })
  end

  def ensure_stream
    # Personal stream for notifications, assigned messages, etc.
    stream_from pubsub_token

    # Account-wide stream for global events (contact created, etc.)
    stream_from "account_#{@current_account.id}"
  end

  def update_subscription
    return if @current_account.blank?

    ::OnlineStatusTracker.update_presence(@current_account.id, @current_user.id)
  end

  def pubsub_token
    @pubsub_token ||= params[:pubsub_token]
  end

  def current_user
    @current_user ||= User.find_by(pubsub_token: pubsub_token)
  end

  def current_account
    return if @current_user.blank?

    @current_account ||= @current_user.accounts.find_by(id: params[:account_id])
  end
end

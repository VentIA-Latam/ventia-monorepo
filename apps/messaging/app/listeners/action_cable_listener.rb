class ActionCableListener < BaseListener
  # Notification events
  def notification_created(event)
    notification = event[:data][:notification]
    broadcast_to_user(notification.user, 'notification.created', notification.push_event_data)
  end

  def notification_updated(event)
    notification = event[:data][:notification]
    broadcast_to_user(notification.user, 'notification.updated', notification.push_event_data)
  end

  def notification_deleted(event)
    data = event[:data][:notification_data]
    user = User.find_by(id: data[:user_id])
    return if user.blank?

    broadcast_to_user(user, 'notification.deleted', { id: data[:id] })
  end

  # Message events
  def message_created(event)
    message = event[:data][:message]
    broadcast_to_account(message.account, 'message.created', message.webhook_data)
  end

  def message_updated(event)
    message = event[:data][:message]
    broadcast_to_account(message.account, 'message.updated', message.webhook_data)
  end

  # Conversation events
  def conversation_created(event)
    conversation = event[:data][:conversation]
    broadcast_to_account(conversation.account, 'conversation.created', conversation.webhook_data)
  end

  def conversation_updated(event)
    conversation = event[:data][:conversation]
    broadcast_to_account(conversation.account, 'conversation.updated', conversation.webhook_data)
  end

  def conversation_status_changed(event)
    conversation = event[:data][:conversation]
    broadcast_to_account(conversation.account, 'conversation.status_changed', conversation.webhook_data)
  end

  def conversation_read(event)
    conversation = event[:data][:conversation]
    broadcast_to_account(conversation.account, 'conversation.read', conversation.webhook_data)
  end

  def assignee_changed(event)
    conversation = event[:data][:conversation]
    broadcast_to_account(conversation.account, 'conversation.assignee_changed', conversation.webhook_data)
  end

  def team_changed(event)
    conversation = event[:data][:conversation]
    broadcast_to_account(conversation.account, 'conversation.team_changed', conversation.webhook_data)
  end

  private

  def broadcast_to_user(user, event_name, data)
    return if user.pubsub_token.blank?

    ActionCableBroadcastJob.perform_later([user.pubsub_token], event_name, data)
  end

  def inbox_user_tokens(inbox)
    inbox.inbox_members.joins(:user).pluck('users.pubsub_token').compact
  end

  def broadcast_to_account(account, event_name, data)
    return if account.blank?

    ActionCableBroadcastJob.perform_later(["account_#{account.id}"], event_name, data)
  end

  def broadcast(tokens, event_name, data)
    return if tokens.blank?

    ActionCableBroadcastJob.perform_later(tokens.uniq, event_name, data)
  end
end

class ActionCableListener < BaseListener
  # Notification events
  def notification_created(event)
    notification = event.data[:notification]
    broadcast_to_user(notification.user, 'notification.created', notification.push_event_data)
  end

  def notification_updated(event)
    notification = event.data[:notification]
    broadcast_to_user(notification.user, 'notification.updated', notification.push_event_data)
  end

  def notification_deleted(event)
    data = event.data[:notification_data]
    user = User.find_by(id: data[:user_id])
    return if user.blank?

    broadcast_to_user(user, 'notification.deleted', { id: data[:id] })
  end

  # Message events
  def message_created(event)
    message = event.data[:message]
    tokens = inbox_user_tokens(message.inbox)
    broadcast(tokens, 'message.created', message.webhook_data)
  end

  def message_updated(event)
    message = event.data[:message]
    tokens = inbox_user_tokens(message.inbox)
    broadcast(tokens, 'message.updated', message.webhook_data)
  end

  # Conversation events
  def conversation_created(event)
    conversation = event.data[:conversation]
    tokens = inbox_user_tokens(conversation.inbox)
    broadcast(tokens, 'conversation.created', conversation.webhook_data)
  end

  def conversation_updated(event)
    conversation = event.data[:conversation]
    tokens = inbox_user_tokens(conversation.inbox)
    broadcast(tokens, 'conversation.updated', conversation.webhook_data)
  end

  def conversation_status_changed(event)
    conversation = event.data[:conversation]
    tokens = inbox_user_tokens(conversation.inbox)
    broadcast(tokens, 'conversation.status_changed', conversation.webhook_data)
  end

  def assignee_changed(event)
    conversation = event.data[:conversation]
    tokens = inbox_user_tokens(conversation.inbox)
    broadcast(tokens, 'conversation.assignee_changed', conversation.webhook_data)
  end

  def team_changed(event)
    conversation = event.data[:conversation]
    tokens = inbox_user_tokens(conversation.inbox)
    broadcast(tokens, 'conversation.team_changed', conversation.webhook_data)
  end

  private

  def broadcast_to_user(user, event_name, data)
    return if user.pubsub_token.blank?

    ActionCableBroadcastJob.perform_later([user.pubsub_token], event_name, data)
  end

  def inbox_user_tokens(inbox)
    inbox.inbox_members.joins(:user).pluck('users.pubsub_token').compact
  end

  def broadcast(tokens, event_name, data)
    return if tokens.blank?

    ActionCableBroadcastJob.perform_later(tokens.uniq, event_name, data)
  end
end

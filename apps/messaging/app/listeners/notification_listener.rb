class NotificationListener < BaseListener
  def conversation_created(event)
    conversation = event[:data][:conversation]
    account = conversation.account

    return if conversation.pending?

    conversation.inbox.inbox_members.includes(:user).each do |inbox_member|
      NotificationBuilder.new(
        notification_type: 'conversation_creation',
        user: inbox_member.user,
        account: account,
        primary_actor: conversation
      ).perform
    end
  end

  def assignee_changed(event)
    conversation = event[:data][:conversation]
    assignee = conversation.assignee
    account = conversation.account

    return if assignee.blank?

    NotificationBuilder.new(
      notification_type: 'conversation_assignment',
      user: assignee,
      account: account,
      primary_actor: conversation
    ).perform
  end

  def message_created(event)
    message = event[:data][:message]
    conversation = message.conversation
    account = message.account

    return if message.private? || message.activity?

    notify_assignee(conversation, account, message)
    notify_participants(conversation, account, message)
  end

  private

  def notify_assignee(conversation, account, message)
    return if conversation.assignee.blank?
    return if message.sender_type == 'User' && message.sender_id == conversation.assignee_id

    NotificationBuilder.new(
      notification_type: 'assigned_conversation_new_message',
      user: conversation.assignee,
      account: account,
      primary_actor: conversation,
      secondary_actor: message
    ).perform
  end

  def notify_participants(conversation, account, message)
    conversation.conversation_participants.includes(:user).each do |participant|
      next if participant.user_id == conversation.assignee_id
      next if message.sender_type == 'User' && message.sender_id == participant.user_id

      NotificationBuilder.new(
        notification_type: 'participating_conversation_new_message',
        user: participant.user,
        account: account,
        primary_actor: conversation,
        secondary_actor: message
      ).perform
    end
  end
end

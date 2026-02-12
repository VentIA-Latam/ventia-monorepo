class Conversations::MessageWindowService
  MESSAGING_WINDOW_24_HOURS = 24.hours

  def initialize(conversation)
    @conversation = conversation
  end

  def can_reply?
    return true if messaging_window.blank?

    last_message_in_messaging_window?(messaging_window)
  end

  private

  def messaging_window
    case @conversation.inbox.channel_type
    when 'Channel::Whatsapp'
      MESSAGING_WINDOW_24_HOURS
    end
  end

  def last_message_in_messaging_window?(time)
    return false if last_incoming_message.nil?

    Time.current < last_incoming_message.created_at + time
  end

  def last_incoming_message
    @last_incoming_message ||= @conversation.messages.incoming.last
  end
end

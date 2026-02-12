class Base::SendOnChannelService
  def initialize(message:)
    @message = message
  end

  def perform
    validate_target_channel
    return unless outgoing_message?
    return if invalid_message?

    perform_reply
  end

  private

  attr_reader :message

  delegate :conversation, to: :message
  delegate :contact, :contact_inbox, :inbox, to: :conversation
  delegate :channel, to: :inbox

  def channel_class
    raise 'Overwrite this method in child class'
  end

  def perform_reply
    raise 'Overwrite this method in child class'
  end

  def outgoing_message_originated_from_channel?
    message.source_id.present?
  end

  def outgoing_message?
    message.outgoing? || message.template?
  end

  def invalid_message?
    message.private? || outgoing_message_originated_from_channel?
  end

  def validate_target_channel
    raise 'Invalid channel service was called' if inbox.channel.class != channel_class
  end
end

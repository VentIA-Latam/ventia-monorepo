class SendReplyJob < ApplicationJob
  queue_as :default

  CHANNEL_SERVICES = {
    'Channel::Whatsapp' => ::Whatsapp::SendOnWhatsappService
  }.freeze

  def perform(message_id)
    message = Message.find(message_id)
    channel_name = message.conversation.inbox.channel.class.to_s

    service_class = CHANNEL_SERVICES[channel_name]
    return unless service_class

    service_class.new(message: message).perform
  end
end

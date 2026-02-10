class Whatsapp::SendOnWhatsappService
  def initialize(conversation:, message:)
    @conversation = conversation
    @message = message
    @inbox = @conversation.inbox
    @channel = @inbox.channel
  end

  def perform
    return unless valid_message?

    # Get the phone number from the contact
    phone_number = @conversation.contact.phone_number
    phone_number = normalize_phone_number(phone_number)

    # Send via provider service
    source_id = @channel.provider_service.send_message(phone_number, @message)

    # Update message with external ID and status
    if source_id.present?
      @message.update!(
        source_id: source_id,
        status: :sent
      )
    else
      @message.update!(status: :failed)
    end

    source_id
  rescue StandardError => e
    Rails.logger.error "[WhatsApp] Send message failed: #{e.message}"
    @message.update!(
      status: :failed,
      content_attributes: @message.content_attributes.merge('external_error' => e.message)
    )
    nil
  end

  private

  def valid_message?
    return false unless @message.outgoing?
    return false if @message.source_id.present? # Already sent
    return false unless @channel.is_a?(Channel::Whatsapp)

    true
  end

  def normalize_phone_number(phone)
    # Remove any non-numeric characters except +
    phone = phone.gsub(/[^\d+]/, '')

    # Ensure it starts with +
    phone = "+#{phone}" unless phone.start_with?('+')

    phone
  end
end

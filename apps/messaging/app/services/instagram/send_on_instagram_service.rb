class Instagram::SendOnInstagramService < Base::SendOnChannelService
  private

  def channel_class
    Channel::Instagram
  end

  def perform_reply
    # The provider sets message.source_id on success and marks failed on error.
    channel.send_message(contact_inbox.source_id, message)
  rescue StandardError => e
    Rails.logger.error "[Instagram] Send failed: #{e.message}"
    message.update!(status: :failed, external_error: e.message)
  end
end

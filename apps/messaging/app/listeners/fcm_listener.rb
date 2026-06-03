class FcmListener < BaseListener
  def message_created(event)
    message, account = extract_message_and_account(event)
    return unless message.incoming?

    conversation = message.conversation
    flag         = conversation.ai_agent_enabled? ? :message_ai_on : :message_ai_off
    contact_name = conversation.contact&.name || 'Cliente'

    NotificationDispatcher.new(account, conversation, contact_name, flag, message: message).perform
  rescue StandardError => e
    Rails.logger.error "[FcmListener] Error in message_created: #{e.message}"
  end

  def conversation_labels_updated(event)
    conversation = event[:data][:conversation]
    labels       = event[:data][:labels]
    account      = conversation.account
    label_titles = labels.map { |l| l[:title] }
    contact_name = conversation.contact&.name || 'Cliente'

    if label_titles.include?('soporte-humano')
      NotificationDispatcher.new(account, conversation, contact_name, :human_support).perform
    end

    if label_titles.include?('en-revisión')
      NotificationDispatcher.new(account, conversation, contact_name, :payment_review).perform
    end
  rescue StandardError => e
    Rails.logger.error "[FcmListener] Error in conversation_labels_updated: #{e.message}"
  end
end

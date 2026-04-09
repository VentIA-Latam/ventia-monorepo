class WebhookListener < BaseListener
  def conversation_created(event)
    conversation, account = extract_conversation_and_account(event)
    dispatch_webhooks(account, 'conversation_created', conversation.webhook_data)
  end

  def conversation_updated(event)
    conversation, account = extract_conversation_and_account(event)
    dispatch_webhooks(account, 'conversation_updated', conversation.webhook_data)
  end

  def conversation_status_changed(event)
    conversation, account = extract_conversation_and_account(event)
    dispatch_webhooks(account, 'conversation_status_changed', conversation.webhook_data)
  end

  def message_created(event)
    message, account = extract_message_and_account(event)
    # Solo despachar para mensajes incoming de conversaciones con AI habilitada
    return unless message.incoming? && message.conversation.ai_agent_enabled?

    dispatch_webhooks(account, 'message_created', message.webhook_data)
  end

  def message_updated(event)
    message, account = extract_message_and_account(event)
    dispatch_webhooks(account, 'message_updated', message.webhook_data)
  end

  def contact_created(event)
    contact, account = extract_contact_and_account(event)
    dispatch_webhooks(account, 'contact_created', contact.webhook_data)
  end

  def contact_updated(event)
    contact, account = extract_contact_and_account(event)
    dispatch_webhooks(account, 'contact_updated', contact.webhook_data)
  end

  private

  def dispatch_webhooks(account, event_name, data)
    return unless account

    account.webhooks.where("subscriptions @> ?", [event_name].to_json).each do |webhook|
      webhook.dispatch_event(event_name, data)
    end
  rescue StandardError => e
    Rails.logger.error "[WebhookListener] Error delivering webhooks for #{event_name}: #{e.message}"
  end
end

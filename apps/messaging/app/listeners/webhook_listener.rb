class WebhookListener < BaseListener
  # Mapping of event methods to webhook event names
  WEBHOOK_EVENTS = {
    conversation_created: 'conversation_created',
    conversation_updated: 'conversation_updated',
    conversation_status_changed: 'conversation_status_changed',
    message_created: 'message_created',
    message_updated: 'message_updated',
    contact_created: 'contact_created',
    contact_updated: 'contact_updated'
  }.freeze

  # Define methods for each event
  WEBHOOK_EVENTS.each do |event, webhook_event_name|
    define_method(event) do |resource|
      deliver_webhooks(resource, webhook_event_name)
    end
  end

  private

  def deliver_webhooks(resource, event_name)
    account = extract_account(resource)
    return unless account

    # Find webhooks that listen to this event
    webhooks = account.webhooks.where(
      "subscriptions @> ?", [event_name].to_json
    )

    webhooks.each do |webhook|
      webhook.dispatch_event(event_name, extract_webhook_data(resource))
    end
  rescue StandardError => e
    Rails.logger.error "[WebhookListener] Error delivering webhooks for #{event_name}: #{e.message}"
  end

  def extract_account(resource)
    if resource.respond_to?(:account)
      resource.account
    elsif resource.respond_to?(:conversation)
      resource.conversation.account
    end
  end

  def extract_webhook_data(resource)
    if resource.respond_to?(:webhook_data)
      resource.webhook_data
    else
      Rails.logger.warn "[WebhookListener] Resource #{resource.class} does not respond to webhook_data"
      { id: resource.id }
    end
  end
end

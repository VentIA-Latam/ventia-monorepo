class AutomationRuleListener < BaseListener
  # Conversation events
  def conversation_created(event)
    process_conversation_event(event, 'conversation_created')
  end

  def conversation_updated(event)
    process_conversation_event(event, 'conversation_updated')
  end

  def conversation_opened(event)
    process_conversation_event(event, 'conversation_opened')
  end

  def conversation_resolved(event)
    process_conversation_event(event, 'conversation_resolved')
  end

  def conversation_status_changed(event)
    conversation = event.data[:conversation]

    case conversation.status
    when 'open'
      conversation_opened(event)
    when 'resolved'
      conversation_resolved(event)
    end
  end

  # Message events
  def message_created(event)
    message = event.data[:message]

    return if ignore_message_created_event?(message)

    account = message.account
    conversation = message.conversation

    return unless rule_present?('message_created', account)

    rules = current_account_rules('message_created', account)

    rules.each do |rule|
      conditions_match = rule.conditions_match?(conversation)
      rule.execute(conversation) if conditions_match
    end
  end

  private

  def process_conversation_event(event, event_name)
    return if performed_by_automation?(event)

    conversation = event.data[:conversation]
    account = conversation.account

    return unless rule_present?(event_name, account)

    rules = current_account_rules(event_name, account)

    rules.each do |rule|
      conditions_match = rule.conditions_match?(conversation)
      rule.execute(conversation) if conditions_match
    end
  end

  def rule_present?(event_name, account)
    return false if account.blank?

    current_account_rules(event_name, account).any?
  end

  def current_account_rules(event_name, account)
    AutomationRule.where(
      event_name: event_name,
      account_id: account.id,
      active: true
    )
  end

  def performed_by_automation?(event)
    event.data[:performed_by].present? && event.data[:performed_by].instance_of?(AutomationRule)
  end

  def ignore_message_created_event?(message)
    # Ignore activity messages or messages from bots
    message.activity? if message.respond_to?(:activity?)
  end
end

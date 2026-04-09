class Macros::ExecutionService
  def initialize(macro:, conversation:)
    @macro = macro
    @conversation = conversation
    @account = macro.account
  end

  def perform
    @macro.actions.each do |action|
      execute_action(action)
    end
  rescue StandardError => e
    Rails.logger.error "[Macros] Execution failed for macro #{@macro.id}: #{e.message}"
  end

  private

  def execute_action(action)
    action_name = action['action_name']
    action_params = action['action_params'] || {}

    case action_name
    when 'send_message'
      send_message(action_params)
    when 'add_label'
      add_label(action_params)
    when 'remove_label'
      remove_label(action_params)
    when 'change_status'
      change_status(action_params)
    when 'resolve_conversation'
      @conversation.resolve!
    when 'snooze_conversation'
      snooze_conversation(action_params)
    when 'change_priority'
      change_priority(action_params)
    when 'send_webhook_event'
      send_webhook_event(action_params)
    when 'add_private_note'
      add_private_note(action_params)
    else
      Rails.logger.warn "[Macros] Unknown action: #{action_name}"
    end
  end

  # Action implementations (reusing Automation::ActionService logic)

  def send_message(params)
    message_content = params['message']
    return if message_content.blank?

    Message.create!(
      account: @account,
      inbox: @conversation.inbox,
      conversation: @conversation,
      message_type: :outgoing,
      content_type: :text,
      content: message_content
    )
  end

  def add_label(params)
    label_ids = Array(params['labels'])
    labels = Label.where(id: label_ids, account: @account)

    labels.each do |label|
      ConversationLabel.find_or_create_by!(
        conversation: @conversation,
        label: label
      )
    end
  end

  def remove_label(params)
    label_ids = Array(params['labels'])
    ConversationLabel.where(
      conversation: @conversation,
      label_id: label_ids
    ).destroy_all
  end

  def change_status(params)
    new_status = params['status']
    return unless Conversation.statuses.key?(new_status)

    @conversation.update!(status: new_status)
  end

  def snooze_conversation(params)
    snooze_until = params['snooze_until'] || 1.hour.from_now
    @conversation.update!(
      status: :snoozed,
      snoozed_until: snooze_until
    )
  end

  def change_priority(params)
    new_priority = params['priority']
    return unless Conversation.priorities.key?(new_priority)

    @conversation.update!(priority: new_priority)
  end

  def send_webhook_event(params)
    webhook_url = params['webhook_url']
    return if webhook_url.blank?

    Webhooks::DeliverJob.perform_later(
      url: webhook_url,
      event_name: 'macro_executed',
      data: {
        conversation: @conversation.webhook_data,
        macro: @macro.webhook_data
      }
    )
  end

  def add_private_note(params)
    note_content = params['message']
    return if note_content.blank?

    Message.create!(
      account: @account,
      inbox: @conversation.inbox,
      conversation: @conversation,
      message_type: :activity,
      content_type: :text,
      content: note_content,
      private: true
    )
  end
end

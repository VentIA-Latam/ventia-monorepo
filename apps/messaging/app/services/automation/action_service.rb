class Automation::ActionService
  def initialize(rule:, conversation:)
    @rule = rule
    @conversation = conversation
  end

  def perform
    @rule.actions.each do |action|
      execute_action(action)
    end
  rescue StandardError => e
    Rails.logger.error "[Automation] Action execution failed for rule #{@rule.id}: #{e.message}"
  end

  private

  def execute_action(action)
    action_name = action['action_name']

    case action_name
    when 'send_message'
      send_message(action['action_params'])
    when 'add_label'
      add_label(action['action_params'])
    when 'remove_label'
      remove_label(action['action_params'])
    when 'change_status'
      change_status(action['action_params'])
    when 'resolve_conversation'
      @conversation.resolve!
    when 'send_webhook_event'
      send_webhook_event(action['action_params'])
    else
      Rails.logger.warn "[Automation] Unknown action: #{action_name}"
    end
  end

  def send_message(params)
    message_content = params['message']
    return if message_content.blank?

    Message.create!(
      account: @conversation.account,
      inbox: @conversation.inbox,
      conversation: @conversation,
      message_type: :outgoing,
      content_type: :text,
      content: message_content
    )
  end

  def add_label(params)
    label_ids = Array(params['labels'])
    labels = Label.where(id: label_ids, account: @conversation.account)

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

  def send_webhook_event(params)
    webhook_url = params['webhook_url']
    return if webhook_url.blank?

    # Queue webhook delivery job
    Webhooks::DeliverJob.perform_later(
      url: webhook_url,
      event_name: 'automation_triggered',
      data: {
        conversation: @conversation.webhook_data,
        rule: @rule.webhook_data
      }
    )
  end
end

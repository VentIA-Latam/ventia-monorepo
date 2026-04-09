class Automation::ConditionValidationService
  def initialize(rule:, conversation:)
    @rule = rule
    @conversation = conversation
  end

  def perform
    return false if @rule.conditions.blank?

    # Check if all conditions are met
    @rule.conditions.all? do |condition|
      evaluate_condition(condition)
    end
  end

  private

  def evaluate_condition(condition)
    attribute = condition['attribute_key']
    operator = condition['filter_operator']
    values = Array(condition['values'])

    case attribute
    when 'status'
      check_status(operator, values)
    when 'inbox_id'
      check_inbox(operator, values)
    when 'message_type'
      check_message_type(operator, values)
    when 'labels'
      check_labels(operator, values)
    when 'priority'
      check_priority(operator, values)
    else
      false
    end
  end

  def check_status(operator, values)
    current_status = @conversation.status

    case operator
    when 'equal_to'
      values.include?(current_status)
    when 'not_equal_to'
      !values.include?(current_status)
    else
      false
    end
  end

  def check_inbox(operator, values)
    inbox_id = @conversation.inbox_id.to_s

    case operator
    when 'equal_to'
      values.include?(inbox_id)
    when 'not_equal_to'
      !values.include?(inbox_id)
    else
      false
    end
  end

  def check_message_type(operator, values)
    # Check the last message type
    last_message = @conversation.messages.last
    return false unless last_message

    message_type = last_message.message_type

    case operator
    when 'equal_to'
      values.include?(message_type)
    when 'not_equal_to'
      !values.include?(message_type)
    else
      false
    end
  end

  def check_labels(operator, values)
    conversation_label_ids = @conversation.labels.pluck(:id).map(&:to_s)

    case operator
    when 'equal_to'
      # Has any of the specified labels
      (conversation_label_ids & values).any?
    when 'not_equal_to'
      # Doesn't have any of the specified labels
      (conversation_label_ids & values).empty?
    else
      false
    end
  end

  def check_priority(operator, values)
    current_priority = @conversation.priority

    case operator
    when 'equal_to'
      values.include?(current_priority)
    when 'not_equal_to'
      !values.include?(current_priority)
    else
      false
    end
  end
end

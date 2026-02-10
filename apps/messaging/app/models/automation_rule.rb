# == Schema Information
#
# Table name: messaging.automation_rules
#
#  id          :uuid             not null, primary key
#  name        :string           not null
#  description :text
#  event_name  :integer          not null
#  conditions  :jsonb            default([])
#  actions     :jsonb            default([])
#  active      :boolean          default(TRUE)
#  account_id  :uuid             not null
#  created_at  :datetime         not null
#  updated_at  :datetime         not null
#
# Indexes
#
#  index_automation_rules_on_account_id  (account_id)
#  index_automation_rules_on_event_name  (event_name)
#  index_automation_rules_on_active      (active)
#

class AutomationRule < ApplicationRecord
  # Events that can trigger automation
  enum :event_name, {
    conversation_created: 0,
    conversation_updated: 1,
    message_created: 2,
    conversation_opened: 3,
    conversation_resolved: 4
  }

  # Validations
  validates :name, presence: true
  validates :event_name, presence: true
  validates :account_id, presence: true
  validates :conditions, presence: true
  validates :actions, presence: true
  validate :validate_conditions_format
  validate :validate_actions_format

  # Associations
  belongs_to :account

  # Scopes
  scope :active, -> { where(active: true) }
  scope :for_event, ->(event) { where(event_name: event) }

  # Callbacks
  after_create_commit :dispatch_create_event
  after_update_commit :dispatch_update_event

  def execute(conversation)
    return unless active?
    return unless conditions_match?(conversation)

    Automation::ActionService.new(rule: self, conversation: conversation).perform
  end

  def toggle!
    update!(active: !active)
  end

  def conditions_match?(conversation)
    Automation::ConditionValidationService.new(rule: self, conversation: conversation).perform
  end

  def conditions_attributes
    %w[status message_type inbox_id labels priority conversation_language]
  end

  def actions_attributes
    %w[send_message add_label remove_label assign_agent change_status resolve_conversation send_webhook_event]
  end

  def webhook_data
    {
      id: id,
      name: name,
      description: description,
      event_name: event_name,
      active: active
    }
  end

  private

  def validate_conditions_format
    return if conditions.blank?

    attributes = conditions.map { |obj| obj['attribute_key'] }
    invalid = attributes - conditions_attributes

    if invalid.any?
      errors.add(:conditions, "Invalid condition attributes: #{invalid.join(', ')}")
    end
  end

  def validate_actions_format
    return if actions.blank?

    action_names = actions.map { |obj| obj['action_name'] }
    invalid = action_names - actions_attributes

    if invalid.any?
      errors.add(:actions, "Invalid action names: #{invalid.join(', ')}")
    end
  end

  def dispatch_create_event
    Rails.logger.info "Automation rule #{id} created"
  end

  def dispatch_update_event
    Rails.logger.info "Automation rule #{id} updated: active=#{active}"
  end
end

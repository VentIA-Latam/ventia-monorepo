# == Schema Information
#
# Table name: messaging.macros
#
#  id             :bigint           not null, primary key
#  name           :string           not null
#  visibility     :integer          default("personal")
#  actions        :jsonb            default([])
#  account_id     :bigint           not null
#  created_by_id  :bigint
#  updated_by_id  :bigint
#  created_at     :datetime         not null
#  updated_at     :datetime         not null
#
# Indexes
#
#  index_macros_on_account_id      (account_id)
#  index_macros_on_created_by_id   (created_by_id)
#  index_macros_on_visibility      (visibility)
#

class Macro < ApplicationRecord
  # Supported actions (same as AutomationRule)
  ACTIONS_ATTRS = %w[
    send_message
    add_label
    remove_label
    change_status
    resolve_conversation
    snooze_conversation
    change_priority
    send_webhook_event
    add_private_note
  ].freeze

  # Validations
  validates :name, presence: true
  validates :account_id, presence: true
  validates :actions, presence: true
  validate :validate_actions_format

  # Associations
  belongs_to :account

  # Enums
  enum :visibility, { personal: 0, global: 1 }

  # Scopes
  scope :global_macros, -> { where(visibility: :global) }
  scope :personal_for, ->(user_id) { where(visibility: :personal, created_by_id: user_id) }

  def webhook_data
    {
      id: id,
      name: name,
      visibility: visibility,
      actions: actions
    }
  end

  private

  def validate_actions_format
    return if actions.blank?

    unless actions.is_a?(Array)
      errors.add(:actions, 'must be an array')
      return
    end

    actions.each do |action|
      unless action.is_a?(Hash) && action['action_name'].present?
        errors.add(:actions, 'invalid format')
        return
      end

      unless ACTIONS_ATTRS.include?(action['action_name'])
        errors.add(:actions, "invalid action: #{action['action_name']}")
      end
    end
  end
end

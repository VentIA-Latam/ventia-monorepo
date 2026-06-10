# == Schema Information
#
# Table name: messaging.canned_responses
#
#  id         :bigint           not null, primary key
#  account_id :bigint           not null
#  short_code :string           not null
#  content    :text             not null
#  actions    :jsonb            default([]), not null
#  created_at :datetime         not null
#  updated_at :datetime         not null
#

class CannedResponse < ApplicationRecord
  # Acciones que pueden asociarse a una respuesta rápida y que Automation::ActionService
  # ejecuta al enviar un mensaje originado en ella. Lista blanca del v1; ampliable sin
  # cambios de arquitectura (mismo esquema jsonb que Macro/AutomationRule).
  ACTION_NAMES = %w[
    add_label
    remove_label
    set_ai_agent
    change_status
    resolve_conversation
  ].freeze

  belongs_to :account

  validates :short_code, presence: true, uniqueness: { scope: :account_id }
  validates :content, presence: true
  validate :validate_actions_format

  scope :search, lambda { |term|
    return all if term.blank?

    prefix = "#{sanitize_sql_like(term)}%"
    where('short_code ILIKE :term OR content ILIKE :term', term: "%#{sanitize_sql_like(term)}%")
      .order(Arel.sql(sanitize_sql_array(['CASE WHEN short_code ILIKE ? THEN 0 ELSE 1 END, short_code ASC', prefix])))
  }

  # Encaja como `rule:` en Automation::ActionService (que usa .actions y .webhook_data).
  def webhook_data
    {
      id: id,
      short_code: short_code,
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

      unless ACTION_NAMES.include?(action['action_name'])
        errors.add(:actions, "invalid action: #{action['action_name']}")
      end
    end
  end
end

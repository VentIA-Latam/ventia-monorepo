# == Schema Information
#
# Table name: messaging.agent_bots
#
#  id          :bigint           not null, primary key
#  name        :string           not null
#  description :text
#  bot_type    :integer          default("webhook")
#  bot_config  :jsonb            default({})
#  account_id  :bigint           not null
#  created_at  :datetime         not null
#  updated_at  :datetime         not null
#
# Indexes
#
#  index_agent_bots_on_account_id  (account_id)
#

class AgentBot < ApplicationRecord
  # Enums
  enum :bot_type, { webhook: 0, csml: 1, dialogflow: 2 }

  # Validations
  validates :name, presence: true
  validates :account_id, presence: true
  validate :validate_bot_config

  # Associations
  belongs_to :account
  has_many :agent_bot_inboxes, dependent: :destroy
  has_many :inboxes, through: :agent_bot_inboxes
  has_many :assigned_conversations,
           class_name: 'Conversation',
           foreign_key: :assignee_agent_bot_id,
           dependent: :nullify

  # Callbacks
  after_create_commit :dispatch_create_event

  def webhook_data
    {
      id: id,
      name: name,
      description: description,
      bot_type: bot_type
    }
  end

  def outgoing_url
    bot_config['outgoing_url'] if webhook?
  end

  private

  def validate_bot_config
    if webhook? && bot_config['outgoing_url'].blank?
      errors.add(:bot_config, 'outgoing_url is required for webhook bot')
    end
  end

  def dispatch_create_event
    Rails.logger.info "Agent bot #{id} created"
  end
end

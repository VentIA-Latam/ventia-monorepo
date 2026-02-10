# == Schema Information
#
# Table name: messaging.agent_bot_inboxes
#
#  id            :uuid             not null, primary key
#  inbox_id      :uuid             not null
#  agent_bot_id  :uuid             not null
#  status        :integer          default("active")
#  created_at    :datetime         not null
#  updated_at    :datetime         not null
#
# Indexes
#
#  index_agent_bot_inboxes_on_inbox_id      (inbox_id) UNIQUE
#  index_agent_bot_inboxes_on_agent_bot_id  (agent_bot_id)
#

class AgentBotInbox < ApplicationRecord
  # Enums
  enum :status, { active: 0, inactive: 1 }

  # Validations
  validates :inbox_id, presence: true, uniqueness: true
  validates :agent_bot_id, presence: true

  # Associations
  belongs_to :inbox
  belongs_to :agent_bot

  # Callbacks
  after_create_commit :dispatch_create_event
  after_destroy_commit :dispatch_destroy_event

  private

  def dispatch_create_event
    Rails.logger.info "Agent bot #{agent_bot_id} assigned to inbox #{inbox_id}"
  end

  def dispatch_destroy_event
    Rails.logger.info "Agent bot removed from inbox #{inbox_id}"
  end
end

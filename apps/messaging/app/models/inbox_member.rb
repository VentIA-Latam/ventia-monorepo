# == Schema Information
#
# Table name: messaging.inbox_members
#
#  id         :uuid             not null, primary key
#  inbox_id   :uuid             not null
#  user_id    :uuid             not null
#  created_at :datetime         not null
#  updated_at :datetime         not null
#

class InboxMember < ApplicationRecord
  belongs_to :inbox
  belongs_to :user

  validates :user_id, presence: true, uniqueness: { scope: :inbox_id }

  after_create :add_agent_to_round_robin
  after_destroy :remove_agent_from_round_robin

  private

  def add_agent_to_round_robin
    AutoAssignment::InboxRoundRobinService.new(inbox: inbox).add_agent_to_queue(user_id)
  end

  def remove_agent_from_round_robin
    return if inbox.blank?

    AutoAssignment::InboxRoundRobinService.new(inbox: inbox).remove_agent_from_queue(user_id)
  end
end

module AssignmentHandler
  extend ActiveSupport::Concern

  included do
    belongs_to :assignee, class_name: 'User', optional: true
    belongs_to :team, optional: true

    has_many :conversation_participants, dependent: :destroy

    before_save :ensure_assignee_is_from_team, if: :team_id_changed?
    after_commit :broadcast_assignment_changes
  end

  private

  def ensure_assignee_is_from_team
    return if team.blank?

    # Clear assignee if not part of new team
    if assignee.present? && !team.members.exists?(id: assignee_id)
      self.assignee_id = nil
    end

    # Auto-assign from team if no assignee and team allows it
    return if assignee_id.present?
    return unless team.allow_auto_assign?

    self.assignee = find_assignee_from_team
  end

  def find_assignee_from_team
    team_member_ids = team.members.pluck(:id)
    inbox_member_ids = inbox.inbox_members.pluck(:user_id)
    allowed_agent_ids = team_member_ids & inbox_member_ids

    return if allowed_agent_ids.empty?

    AutoAssignment::AgentAssignmentService.new(
      conversation: self,
      allowed_agent_ids: allowed_agent_ids
    ).find_assignee
  end

  def broadcast_assignment_changes
    if saved_change_to_assignee_id?
      Rails.logger.info "[Event] Conversation #{id} assignee changed"
      broadcast(:assignee_changed, data: { conversation: self })
    end

    return unless saved_change_to_team_id?

    Rails.logger.info "[Event] Conversation #{id} team changed"
    broadcast(:team_changed, data: { conversation: self })
  end
end

module AutoAssignmentHandler
  extend ActiveSupport::Concern

  included do
    after_save :run_auto_assignment
  end

  private

  def run_auto_assignment
    return unless conversation_status_changed_to_open?
    return unless should_run_auto_assignment?

    AutoAssignment::AgentAssignmentService.new(
      conversation: self,
      allowed_agent_ids: inbox.inbox_members.pluck(:user_id)
    ).perform
  end

  def conversation_status_changed_to_open?
    saved_change_to_status? && open?
  end

  def should_run_auto_assignment?
    return false unless inbox.enable_auto_assignment?

    assignee.blank? || inbox.inbox_members.where(user_id: assignee_id).none?
  end
end

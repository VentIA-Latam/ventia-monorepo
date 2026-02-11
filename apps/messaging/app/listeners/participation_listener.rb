class ParticipationListener < BaseListener
  def assignee_changed(event)
    conversation = event.data[:conversation]
    return if conversation.assignee_id.blank?

    conversation.conversation_participants.find_or_create_by!(user_id: conversation.assignee_id)
  rescue ActiveRecord::RecordNotUnique, ActiveRecord::RecordInvalid => e
    Rails.logger.warn "[ParticipationListener] Skipped: #{e.message}"
  end
end

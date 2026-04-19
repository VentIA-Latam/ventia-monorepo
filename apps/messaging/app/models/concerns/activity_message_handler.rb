module ActivityMessageHandler
  extend ActiveSupport::Concern

  included do
    after_update_commit :generate_activity_messages
  end

  private

  def generate_activity_messages
    generate_escalation_activity
    generate_status_activity
    generate_stage_activity
    generate_priority_activity
    generate_temperature_activity
    generate_assignee_activity
  end

  def generate_escalation_activity
    return unless saved_change_to_ai_agent_enabled?

    action = ai_agent_enabled? ? 'reactivada' : 'desactivada'
    create_activity_message("IA #{action} por #{activity_user_name}")
  end

  def generate_status_activity
    return unless saved_change_to_status?

    status_labels = { 'open' => 'abierta', 'resolved' => 'resuelta', 'pending' => 'pendiente', 'snoozed' => 'pospuesta' }
    label = status_labels[status] || status
    create_activity_message("Conversación #{label} por #{activity_user_name}")
  end

  def generate_stage_activity
    return unless saved_change_to_stage?

    stage_labels = { 'pre_sale' => 'Pre-venta', 'sale' => 'Venta' }
    label = stage_labels[stage] || stage
    create_activity_message("Etapa cambiada a #{label} por #{activity_user_name}")
  end

  def generate_priority_activity
    return unless saved_change_to_priority?

    priority_labels = { 'low' => 'Baja', 'medium' => 'Media', 'high' => 'Alta', 'urgent' => 'Urgente' }
    label = priority_labels[priority] || priority
    create_activity_message("Prioridad cambiada a #{label} por #{activity_user_name}")
  end

  def generate_temperature_activity
    return unless saved_change_to_temperature?

    temp_name = account&.temperature_config&.find { |t| t["key"] == temperature }&.dig("name") || temperature
    create_activity_message("Temperatura cambiada a #{temp_name} por #{activity_user_name}")
  end

  def generate_assignee_activity
    return unless saved_change_to_assignee_id?

    if assignee_id.present?
      assignee_name = assignee&.name || 'Desconocido'
      create_activity_message("Asignado a #{assignee_name} por #{activity_user_name}")
    else
      create_activity_message("Desasignado por #{activity_user_name}")
    end
  end

  def create_activity_message(content)
    messages.create!(
      message_type: :activity,
      content: content,
      account_id: account_id,
      inbox_id: inbox_id,
      sender: Current.user,
      skip_send_reply: true
    )
  rescue StandardError => e
    Rails.logger.error "[ActivityMessage] Failed to create activity for conversation #{id}: #{e.message}"
  end

  def activity_user_name
    Current.user&.name || 'Sistema'
  end
end

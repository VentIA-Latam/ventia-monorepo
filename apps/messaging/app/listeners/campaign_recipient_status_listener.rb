# Sincroniza el estado de Message (que se actualiza desde el webhook de Meta) con la
# fila correspondiente en campaign_recipients, si el message pertenece a una campaña.
#
# Mecanismo:
# - Message#after_update_commit fire `message_updated` event (Wisper) cuando status cambia.
# - Este listener captura ese evento, busca el recipient por message_id.
# - Si encuentra, mapea Message.status → CampaignRecipient.status + timestamps.
# - Actualiza counters de la campaña (failed_count) y dispara CompletionChecker.
#
# Mensajes que no son de campaña: el listener busca pero no encuentra y se sale silenciosamente.
class CampaignRecipientStatusListener < BaseListener
  def message_updated(event)
    message = event[:data][:message]
    changed = event[:data][:changed_attributes] || {}
    return unless changed.key?('status') || changed.key?(:status)

    recipient = CampaignRecipient.find_by(message_id: message.id)
    return unless recipient

    case message.status.to_sym
    when :delivered
      recipient.update!(status: :delivered, delivered_at: Time.current) unless recipient.delivered? || recipient.read?
    when :read
      recipient.update!(status: :read, read_at: Time.current) unless recipient.read?
    when :failed
      return if recipient.failed?

      recipient.update!(status: :failed, external_error: message.try(:external_error))
      Campaign.where(id: recipient.campaign_id).update_all('failed_count = failed_count + 1')
    end

    Campaigns::CompletionChecker.new(recipient.campaign).maybe_complete!
  rescue StandardError => e
    # Patrón estándar de listeners (ver FcmListener): no propagar a otros listeners
    # ni romper el evento. Log para diagnóstico.
    msg_id = event.dig(:data, :message)&.id
    Rails.logger.error "[CampaignRecipientStatusListener] message_updated failed " \
                       "(message_id=#{msg_id}): #{e.class.name}: #{e.message}"
  end
end

class Whatsapp::SendOnWhatsappService < Base::SendOnChannelService
  private

  def channel_class
    Channel::Whatsapp
  end

  def perform_reply
    should_send_template_message = template_params.present? || !message.conversation.can_reply?
    if should_send_template_message
      send_template_message
    else
      send_session_message
    end
  rescue StandardError => e
    Rails.logger.error "[WhatsApp] Send failed: #{e.message}"
    message.update!(status: :failed, external_error: e.message)
  end

  def send_template_message
    processor = Whatsapp::TemplateProcessorService.new(
      channel: channel,
      template_params: template_params,
      message: message
    )

    name, namespace, lang_code, processed_parameters = processor.call

    if name.blank?
      message.update!(status: :failed, external_error: 'Template not found or invalid template name')
      return
    end

    recipient = resolve_recipient
    if template_category == 'AUTHENTICATION' && bsuid_recipient?(recipient)
      message.update!(
        status: :failed,
        external_error: '131062: Authentication templates require phone number (BSUID not supported)'
      )
      return
    end

    message_id = channel.send_template(recipient, {
                                         name: name,
                                         namespace: namespace,
                                         lang_code: lang_code,
                                         parameters: processed_parameters
                                       }, message)
    message.update!(source_id: message_id) if message_id.present?
  end

  def send_session_message
    message_id = channel.send_message(resolve_recipient, message)
    message.update!(source_id: message_id) if message_id.present?
  end

  def template_params
    message.additional_attributes && message.additional_attributes['template_params']
  end

  def template_category
    template_params&.dig('template_snapshot', 'category')
  end

  # Cuando WHATSAPP_BSUID_SENDING=true (Meta junio 2026), usa BSUID directo.
  # Mientras tanto, fallback a teléfono del contacto.
  def resolve_recipient
    source_id = message.conversation.contact_inbox.source_id

    if bsuid_recipient?(source_id) && !bsuid_sending_enabled?
      phone = message.conversation.contact.phone_number&.gsub(/[^\d]/, '')
      return phone if phone.present?
    end

    source_id
  end

  def bsuid_sending_enabled?
    ENV.fetch('WHATSAPP_BSUID_SENDING', 'false') == 'true'
  end

  def bsuid_recipient?(source_id)
    source_id.to_s.match?(/\A[A-Z]{2}\./)
  end
end

class Conversations::EnsureFromPhoneService
  E164_REGEX = /\A\+[1-9]\d{1,14}\z/

  Result = Struct.new(
    :contact, :contact_inbox, :conversation, :message,
    :contact_created, :conversation_created,
    keyword_init: true
  )

  class InvalidPhoneError        < StandardError; end
  class InvalidInboxChannelError < StandardError; end

  def initialize(account:, inbox:, phone:, template_params:,
                 contact_name: nil, campaign: nil)
    @account         = account
    @inbox           = inbox
    @phone           = phone
    @template_params = template_params
    @contact_name    = contact_name
    @campaign        = campaign
  end

  def perform
    validate_inbox!
    normalized = normalize_phone!
    contact, contact_created    = ensure_contact(normalized)
    contact_inbox               = ensure_contact_inbox(contact, normalized)
    conversation, convo_created = ensure_conversation(contact, contact_inbox)
    message                     = build_and_save_message(conversation)
    send_via_whatsapp(message)

    Result.new(
      contact:              contact,
      contact_inbox:        contact_inbox,
      conversation:         conversation,
      message:              message,
      contact_created:      contact_created,
      conversation_created: convo_created
    )
  end

  private

  def validate_inbox!
    return if @inbox.channel.is_a?(Channel::Whatsapp)

    raise InvalidInboxChannelError,
          'send_by_phone solo aplica a inboxes de WhatsApp'
  end

  def normalize_phone!
    cleaned = @phone.to_s.gsub(/[\s\-]/, '')
    raise InvalidPhoneError, 'phone debe estar en formato E.164 (+...)' unless cleaned.match?(E164_REGEX)

    cleaned
  end

  def ensure_contact(normalized)
    existing = @account.contacts.find_by(phone_number: normalized)
    return [existing, false] if existing

    contact = @account.contacts.create!(
      phone_number: normalized,
      name:         @contact_name.presence,
      contact_type: :lead
    )
    [contact, true]
  end

  # Mirror del patrón de Campaigns::TriggerService líneas 70-93:
  # prefiere bsuid existente si el flag está habilitado; sino phone sin '+'.
  def ensure_contact_inbox(contact, normalized)
    existing = ContactInbox
                 .where(contact: contact, inbox: @inbox)
                 .order(Arel.sql('whatsapp_bsuid IS NULL ASC'))
                 .first

    bsuid     = existing&.whatsapp_bsuid
    phone_raw = normalized.delete_prefix('+')
    source_id = if bsuid.present? && bsuid_sending_enabled?
                  bsuid
                else
                  phone_raw
                end

    ContactInbox.find_or_create_by!(
      contact: contact, inbox: @inbox, source_id: source_id
    ) do |ci|
      # Solo copiamos bsuid si lo usamos como source_id; sino el bsuid ya está tomado
      # por el CI existente y la unicidad falla.
      ci.whatsapp_bsuid = bsuid if bsuid.present? && source_id == bsuid
    end
  end

  def ensure_conversation(contact, contact_inbox)
    open_conversation = @account.conversations
                                .where(
                                  contact_id: contact.id,
                                  inbox_id:   @inbox.id,
                                  status:     :open
                                )
                                .order(created_at: :desc)
                                .first

    return [open_conversation, false] if open_conversation

    conversation = Conversation.create!(
      account:       @account,
      inbox:         @inbox,
      contact:       contact,
      contact_inbox: contact_inbox,
      campaign:      @campaign,
      status:        :open
    )
    [conversation, true]
  end

  def build_and_save_message(conversation)
    raise ArgumentError, 'template_params requerido' if @template_params.blank?

    tp = @template_params.with_indifferent_access
    built = Whatsapp::TemplateMessageBuilder.new(
      conversation:     conversation,
      name:             tp[:name],
      language:         tp[:language],
      processed_params: tp[:processed_params]&.to_h
    ).build

    Message.create!(
      built.merge(
        account:      @account,
        inbox:        @inbox,
        conversation: conversation
      )
    )
  end

  # SendOnWhatsappService hereda Base::SendOnChannelService#initialize(message:) — solo message kwarg.
  # El servicio captura StandardError internamente y marca message.status = :failed con external_error,
  # entonces nuestro rescue extra es defensa-en-profundidad para errores antes de perform_reply.
  def send_via_whatsapp(message)
    Whatsapp::SendOnWhatsappService.new(message: message).perform
  rescue StandardError => e
    Rails.logger.error "[EnsureFromPhone] Send failed " \
                       "(account_id=#{@account.id}, conversation_id=#{message.conversation_id}, " \
                       "message_id=#{message.id}): #{e.message}"
    # no re-raise: el message queda en DB con status correspondiente
  end

  def bsuid_sending_enabled?
    ENV.fetch('WHATSAPP_BSUID_SENDING', 'false') == 'true'
  end
end

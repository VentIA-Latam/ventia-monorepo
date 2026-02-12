class Whatsapp::IncomingMessageService
  include Whatsapp::IncomingMessageServiceHelpers

  def initialize(inbox:, params:)
    @inbox = inbox
    @params = params
    @channel = @inbox.channel
  end

  def perform
    return unless valid_payload?

    process_status_updates if status_events.present?
    process_messages if messages_data.present?
  end

  private

  def valid_payload?
    @params['entry'].present? || @params[:entry].present?
  end

  def value_data
    @value_data ||= begin
      entry = @params['entry'] || @params[:entry]
      return {} if entry.blank?

      changes = entry.first['changes'] || entry.first[:changes]
      return {} if changes.blank?

      changes.first['value'] || changes.first[:value] || {}
    end
  end

  def messages_data
    @messages_data ||= value_data['messages'] || value_data[:messages] || []
  end

  def contacts_data
    @contacts_data ||= value_data['contacts'] || value_data[:contacts] || []
  end

  def status_events
    @status_events ||= value_data['statuses'] || value_data[:statuses] || []
  end

  # --- Status updates (delivery/read receipts) ---

  def process_status_updates
    status_events.each do |status_event|
      message_id = status_event['id'] || status_event[:id]
      status = status_event['status'] || status_event[:status]

      message = Message.find_by(source_id: message_id)
      next unless message

      update_message_status(message, status)
    end
  end

  def update_message_status(message, status)
    case status
    when 'sent'
      message.update(status: :sent) if message.status_before_type_cast < Message.statuses[:sent]
    when 'delivered'
      message.update(status: :delivered) if message.status_before_type_cast < Message.statuses[:delivered]
    when 'read'
      message.update(status: :read)
    when 'failed'
      message.update(status: :failed)
    end
  end

  # --- Incoming messages ---

  def process_messages
    messages_data.each do |message_data|
      next if error_webhook_event?(message_data)
      next if unprocessable_message_type?(message_data['type'] || message_data[:type])

      process_single_message(message_data)
    end
  end

  def process_single_message(message_data)
    msg_type = message_data['type'] || message_data[:type]
    msg_id = message_data['id'] || message_data[:id]
    from = message_data['from'] || message_data[:from]

    return if Message.exists?(source_id: msg_id)

    contact_info = find_contact_info(from)

    ActiveRecord::Base.transaction do
      @contact = find_or_create_contact(from, contact_info)
      @contact_inbox = find_or_create_contact_inbox(@contact, from)
      @conversation = find_or_create_conversation(@contact, @contact_inbox)

      in_reply_to_external_id = message_data.dig('context', 'id') || message_data.dig(:context, :id)

      create_message(
        conversation: @conversation,
        contact: @contact,
        message_data: message_data,
        msg_type: msg_type,
        msg_id: msg_id,
        in_reply_to_external_id: in_reply_to_external_id
      )
    end
  end

  def find_contact_info(wa_id)
    contacts_data.find do |c|
      (c['wa_id'] || c[:wa_id]) == wa_id
    end || {}
  end

  def find_or_create_contact(phone, contact_info)
    name = contact_info.dig('profile', 'name') || contact_info.dig(:profile, :name) || phone

    Contact.find_or_create_by!(
      account: @inbox.account,
      phone_number: "+#{phone}"
    ) do |contact|
      contact.name = name
    end
  end

  def find_or_create_contact_inbox(contact, source_id)
    ContactInbox.find_or_create_by!(
      contact: contact,
      inbox: @inbox,
      source_id: source_id
    )
  end

  def find_or_create_conversation(contact, contact_inbox)
    conversation = contact.conversations
                          .where(inbox: @inbox, status: [:open, :pending])
                          .first

    conversation || Conversation.create!(
      account: @inbox.account,
      inbox: @inbox,
      contact: contact,
      contact_inbox: contact_inbox,
      status: :open
    )
  end

  def create_message(conversation:, contact:, message_data:, msg_type:, msg_id:, in_reply_to_external_id: nil)
    content = extract_message_content(message_data, msg_type)
    content_type = file_content_type(msg_type)

    attrs = {
      account: @inbox.account,
      inbox: @inbox,
      conversation: conversation,
      sender: contact,
      message_type: :incoming,
      content_type: content_type,
      content: content,
      source_id: msg_id,
      content_attributes: build_content_attributes(message_data, msg_type, in_reply_to_external_id)
    }

    Message.create!(attrs)
  end

  def extract_message_content(message_data, msg_type)
    case msg_type
    when 'text'
      message_data.dig('text', 'body') || message_data.dig(:text, :body)
    when 'image', 'audio', 'video', 'document'
      message_data.dig(msg_type, 'caption') || message_data.dig(msg_type.to_sym, :caption) || ''
    when 'location'
      lat = message_data.dig('location', 'latitude') || message_data.dig(:location, :latitude)
      lng = message_data.dig('location', 'longitude') || message_data.dig(:location, :longitude)
      "Location: #{lat}, #{lng}"
    when 'contacts'
      formatted_name = message_data.dig('contacts', 0, 'name', 'formatted_name') ||
                        message_data.dig(:contacts, 0, :name, :formatted_name)
      formatted_name || ''
    when 'button'
      message_data.dig('button', 'text') || message_data.dig(:button, :text) || ''
    when 'interactive'
      message_data.dig('interactive', 'button_reply', 'title') ||
        message_data.dig('interactive', 'list_reply', 'title') ||
        message_data.dig(:interactive, :button_reply, :title) ||
        message_data.dig(:interactive, :list_reply, :title) || ''
    else
      message_content(message_data.with_indifferent_access) || ''
    end
  end

  def build_content_attributes(message_data, msg_type, in_reply_to_external_id)
    attrs = {}

    attrs['in_reply_to'] = in_reply_to_external_id if in_reply_to_external_id.present?

    if msg_type != 'text'
      media_id = message_data.dig(msg_type, 'id') || message_data.dig(msg_type.to_sym, :id)
      attrs['media_id'] = media_id if media_id.present?
    end

    attrs
  end
end

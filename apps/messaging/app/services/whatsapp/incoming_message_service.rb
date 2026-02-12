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

      update_message_status(message, status, status_event)
    end
  end

  def update_message_status(message, status, status_event = {})
    case status
    when 'sent'
      message.update(status: :sent) if message.status_before_type_cast < Message.statuses[:sent]
    when 'delivered'
      message.update(status: :delivered) if message.status_before_type_cast < Message.statuses[:delivered]
    when 'read'
      message.update(status: :read)
    when 'failed'
      errors = status_event['errors'] || status_event[:errors]
      error_detail = errors&.first
      external_error = error_detail ? "#{error_detail['code'] || error_detail[:code]}: #{error_detail['title'] || error_detail[:title]}" : nil
      message.update(status: :failed, external_error: external_error)
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

    # Redis + DB deduplication to prevent race conditions
    return if message_under_process?(msg_id)
    return if Message.exists?(source_id: msg_id)

    cache_message_source_id(msg_id)
    contact_info = find_contact_info(from)

    ActiveRecord::Base.transaction do
      @contact = find_or_create_contact(from, contact_info)
      @contact_inbox = find_or_create_contact_inbox(@contact, from)
      @conversation = find_or_create_conversation(@contact, @contact_inbox)

      in_reply_to_external_id = message_data.dig('context', 'id') || message_data.dig(:context, :id)

      if msg_type == 'contacts'
        create_contact_messages(message_data, msg_id, in_reply_to_external_id)
      else
        create_regular_message(message_data, msg_type, msg_id, in_reply_to_external_id)
      end
    end

    update_contact_with_profile_name(contact_info)
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
    conversation = if @inbox.lock_to_single_conversation
                     contact_inbox.conversations.where(inbox: @inbox).last
                   else
                     contact.conversations
                            .where(inbox: @inbox, status: [:open, :pending])
                            .first
                   end

    conversation || Conversation.create!(
      account: @inbox.account,
      inbox: @inbox,
      contact: contact,
      contact_inbox: contact_inbox,
      status: :open
    )
  end

  # --- Message creation ---

  def create_regular_message(message_data, msg_type, msg_id, in_reply_to_external_id)
    content = extract_message_content(message_data, msg_type)

    @message = @conversation.messages.create!(
      account: @inbox.account,
      inbox: @inbox,
      sender: @contact,
      message_type: :incoming,
      content_type: file_content_type(msg_type),
      content: content,
      source_id: msg_id,
      content_attributes: build_content_attributes(in_reply_to_external_id)
    )

    attach_files(message_data, msg_type)
    attach_location(message_data) if msg_type == 'location'
    @message.save! if @message.changed?
  end

  def create_contact_messages(message_data, msg_id, in_reply_to_external_id)
    contacts_list = message_data['contacts'] || message_data[:contacts] || []

    contacts_list.each do |contact_data|
      formatted_name = contact_data.dig('name', 'formatted_name') || contact_data.dig(:name, :formatted_name) || ''

      @message = @conversation.messages.create!(
        account: @inbox.account,
        inbox: @inbox,
        sender: @contact,
        message_type: :incoming,
        content_type: :text,
        content: formatted_name,
        source_id: msg_id,
        content_attributes: build_content_attributes(in_reply_to_external_id)
      )

      attach_contact(contact_data)
      @message.save! if @message.changed?
    end
  end

  # --- Attachments ---

  def attach_files(message_data, msg_type)
    return if %w[text button interactive location contacts].include?(msg_type)

    attachment_payload = message_data[msg_type] || message_data[msg_type.to_sym]
    return if attachment_payload.blank?

    # Use caption as content if message content is blank
    caption = attachment_payload['caption'] || attachment_payload[:caption]
    @message.content = caption if caption.present? && @message.content.blank?

    media_id = attachment_payload['id'] || attachment_payload[:id]
    return if media_id.blank?

    attachment_file = @channel.provider_service.download_media(media_id)
    return if attachment_file.blank?

    @message.attachments.new(
      account_id: @inbox.account.id,
      file_type: file_content_type(msg_type),
      file: {
        io: attachment_file,
        filename: attachment_file.original_filename,
        content_type: attachment_file.content_type
      }
    )
  end

  def attach_location(message_data)
    location = message_data['location'] || message_data[:location]
    return if location.blank?

    location_name = location['name'] || location[:name]
    location_address = location['address'] || location[:address]
    fallback = location_name ? "#{location_name}, #{location_address}" : ''

    @message.attachments.new(
      account_id: @inbox.account.id,
      file_type: :location,
      coordinates_lat: location['latitude'] || location[:latitude],
      coordinates_long: location['longitude'] || location[:longitude],
      external_url: location['url'] || location[:url]
    )

    @message.content = fallback if @message.content.blank?
  end

  def attach_contact(contact_data)
    phones = contact_data['phones'] || contact_data[:phones]
    phones = [{ 'phone' => 'Phone number is not available' }] if phones.blank?

    name_info = contact_data['name'] || contact_data[:name] || {}
    contact_meta = {
      firstName: name_info['first_name'] || name_info[:first_name],
      lastName: name_info['last_name'] || name_info[:last_name]
    }.compact

    phones.each do |phone|
      @message.attachments.new(
        account_id: @inbox.account.id,
        file_type: :contact,
        meta: contact_meta
      )
    end
  end

  # --- Content extraction ---

  def extract_message_content(message_data, msg_type)
    case msg_type
    when 'text'
      message_data.dig('text', 'body') || message_data.dig(:text, :body)
    when 'image', 'audio', 'video', 'document', 'sticker'
      message_data.dig(msg_type, 'caption') || message_data.dig(msg_type.to_sym, :caption) || ''
    when 'location'
      lat = message_data.dig('location', 'latitude') || message_data.dig(:location, :latitude)
      lng = message_data.dig('location', 'longitude') || message_data.dig(:location, :longitude)
      name = message_data.dig('location', 'name') || message_data.dig(:location, :name)
      name.present? ? name : "Location: #{lat}, #{lng}"
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

  def build_content_attributes(in_reply_to_external_id)
    attrs = {}
    attrs['in_reply_to'] = in_reply_to_external_id if in_reply_to_external_id.present?
    attrs
  end

  def update_contact_with_profile_name(contact_info)
    return if @contact.blank? || contact_info.blank?

    profile_name = contact_info.dig('profile', 'name') || contact_info.dig(:profile, :name)
    return if profile_name.blank?
    return if @contact.name == profile_name

    phone = @contact.phone_number
    return unless @contact.name == phone || @contact.name == phone&.gsub('+', '')

    @contact.update(name: profile_name)
  end

  # --- Redis deduplication ---

  def message_under_process?(source_id)
    $redis.exists?("whatsapp_message:#{source_id}")
  end

  def cache_message_source_id(source_id)
    $redis.setex("whatsapp_message:#{source_id}", 5.minutes.to_i, true)
  end
end

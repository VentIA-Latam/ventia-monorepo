class Whatsapp::IncomingMessageService
  include Whatsapp::IncomingMessageServiceHelpers
  include Whatsapp::ContactResolution

  def initialize(inbox:, params:, outgoing_echo: false)
    @inbox = inbox
    @params = params
    @channel = @inbox.channel
    @outgoing_echo = outgoing_echo
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
    @messages_data ||= if @outgoing_echo
                          value_data['message_echoes'] || value_data[:message_echoes] || []
                        else
                          value_data['messages'] || value_data[:messages] || []
                        end
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
      if unavailable_message?(message_data)
        Whatsapp::UnavailableMessageHandler.new(
          inbox: @inbox,
          message_data: message_data,
          contacts_data: contacts_data
        ).perform
        next
      end

      next if error_webhook_event?(message_data)
      next if unprocessable_message_type?(message_data['type'] || message_data[:type])

      process_single_message(message_data)
    end
  end

  def unavailable_message?(message_data)
    type = message_data['type'] || message_data[:type]
    errors = message_data['errors'] || message_data[:errors]
    return false unless type == 'unsupported'
    return false unless errors.is_a?(Array)

    code = errors.first&.dig('code') || errors.first&.dig(:code)
    code == 131_060
  end

  def process_single_message(message_data)
    msg_type = message_data['type'] || message_data[:type]
    msg_id   = message_data['id']   || message_data[:id]
    from     = message_data['from'] || message_data[:from]
    bsuid    = message_data['from_user_id'] || message_data[:from_user_id]

    # For echo messages, contact phone is in 'to' field (reversed — business sent TO customer)
    contact_phone = if @outgoing_echo
                      message_data['to'] || message_data[:to]
                    else
                      from
                    end

    # Redis + DB deduplication to prevent race conditions
    return if message_under_process?(msg_id)
    return if Message.exists?(source_id: msg_id)

    cache_message_source_id(msg_id)
    contact_info = @outgoing_echo ? {} : find_contact_info(from, bsuid)

    ActiveRecord::Base.transaction do
      @contact       = find_or_create_contact(contact_phone, bsuid, contact_info)
      @contact_inbox = find_or_create_contact_inbox(@contact, contact_phone, bsuid)
      return if @contact_inbox.nil?

      @conversation  = find_or_create_conversation(@contact, @contact_inbox)

      in_reply_to_external_id = message_data.dig('context', 'id') || message_data.dig(:context, :id)

      if msg_type == 'contacts'
        create_contact_messages(message_data, msg_id, in_reply_to_external_id)
      else
        create_regular_message(message_data, msg_type, msg_id, in_reply_to_external_id)
      end
    end

    update_contact_with_profile_name(contact_info)
  end

  def find_contact_info(phone, bsuid)
    contacts_data.find do |c|
      ((c['wa_id']   || c[:wa_id])   == phone && phone.present?) ||
      ((c['user_id'] || c[:user_id]) == bsuid && bsuid.present?)
    end || {}
  end

  # --- Message creation ---

  def create_regular_message(message_data, msg_type, msg_id, in_reply_to_external_id)
    content = extract_message_content(message_data, msg_type)
    referral = message_data['referral'] || message_data[:referral]

    echo_attrs = @outgoing_echo ? { external_echo: true } : {}
    content_attrs = build_content_attributes(in_reply_to_external_id, referral).merge(echo_attrs)

    @message = @conversation.messages.new(
      account: @inbox.account,
      inbox: @inbox,
      sender: @outgoing_echo ? nil : @contact,
      message_type: @outgoing_echo ? :outgoing : :incoming,
      status: @outgoing_echo ? :delivered : :sent,
      content: content,
      source_id: msg_id,
      content_attributes: content_attrs
    )
    # Skip send_reply for echoes — message was already sent from WhatsApp Business App
    @message.skip_send_reply = true if @outgoing_echo

    attach_files(message_data, msg_type)
    attach_location(message_data) if msg_type == 'location'
    @message.save!
  end

  def create_contact_messages(message_data, msg_id, in_reply_to_external_id)
    contacts_list = message_data['contacts'] || message_data[:contacts] || []

    contacts_list.each do |contact_data|
      formatted_name = contact_data.dig('name', 'formatted_name') || contact_data.dig(:name, :formatted_name) || ''

      echo_attrs = @outgoing_echo ? { external_echo: true } : {}
      content_attrs = build_content_attributes(in_reply_to_external_id).merge(echo_attrs)

      @message = @conversation.messages.new(
        account: @inbox.account,
        inbox: @inbox,
        sender: @outgoing_echo ? nil : @contact,
        message_type: @outgoing_echo ? :outgoing : :incoming,
        status: @outgoing_echo ? :delivered : :sent,
        content_type: :text,
        content: formatted_name,
        source_id: msg_id,
        content_attributes: content_attrs
      )
      @message.skip_send_reply = true if @outgoing_echo

      attach_contact(contact_data)
      @message.save!
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
      lastName: name_info['last_name'] || name_info[:last_name],
      phone: phones.first&.dig('phone') || phones.first&.dig(:phone)
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

  def build_content_attributes(in_reply_to_external_id, referral = nil)
    attrs = {}
    attrs['in_reply_to'] = in_reply_to_external_id if in_reply_to_external_id.present?
    if referral.present?
      attrs['referral'] = {
        'source_url' => referral['source_url'] || referral[:source_url],
        'source_type' => referral['source_type'] || referral[:source_type],
        'source_id' => referral['source_id'] || referral[:source_id],
        'headline' => referral['headline'] || referral[:headline],
        'body' => referral['body'] || referral[:body],
        'media_type' => referral['media_type'] || referral[:media_type],
        'image_url' => referral['image_url'] || referral[:image_url]
      }.compact
    end
    attrs
  end

  def update_contact_with_profile_name(contact_info)
    return if @contact.blank? || contact_info.blank?

    profile_name = contact_info.dig('profile', 'name') || contact_info.dig(:profile, :name)
    return if profile_name.blank?
    return if @contact.name == profile_name

    default_name = @contact.phone_number || @contact_inbox&.whatsapp_bsuid
    return if default_name.blank?
    return unless @contact.name == default_name || @contact.name == default_name.gsub('+', '')

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

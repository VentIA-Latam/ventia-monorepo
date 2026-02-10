class Whatsapp::IncomingMessageService
  def initialize(inbox:, params:)
    @inbox = inbox
    @params = params
    @channel = @inbox.channel
  end

  def perform
    return unless valid_message?

    process_message
  end

  private

  def valid_message?
    @params['entry']&.any? &&
      @params['entry'].first['changes']&.any? &&
      message_data.present?
  end

  def message_data
    @message_data ||= @params['entry'].first.dig('changes', 0, 'value', 'messages', 0)
  end

  def contact_data
    @contact_data ||= @params['entry'].first.dig('changes', 0, 'value', 'contacts', 0)
  end

  def process_message
    contact = find_or_create_contact
    contact_inbox = find_or_create_contact_inbox(contact)
    conversation = find_or_create_conversation(contact, contact_inbox)
    create_message(conversation, contact)
  end

  def find_or_create_contact
    phone = contact_data['wa_id']
    name = contact_data.dig('profile', 'name') || phone

    Contact.find_or_create_by!(
      account: @inbox.account,
      phone_number: "+#{phone}"
    ) do |contact|
      contact.name = name
    end
  end

  def find_or_create_contact_inbox(contact)
    source_id = contact_data['wa_id']

    ContactInbox.find_or_create_by!(
      contact: contact,
      inbox: @inbox,
      source_id: source_id
    )
  end

  def find_or_create_conversation(contact, contact_inbox)
    # Find open conversation or create new one
    conversation = contact.conversations
                          .where(inbox: @inbox, status: [:open, :pending])
                          .first

    conversation ||= Conversation.create!(
      account: @inbox.account,
      inbox: @inbox,
      contact: contact,
      contact_inbox: contact_inbox,
      status: :open
    )

    conversation
  end

  def create_message(conversation, contact)
    Message.create!(
      account: @inbox.account,
      inbox: @inbox,
      conversation: conversation,
      sender: contact,
      message_type: :incoming,
      content_type: determine_content_type,
      content: message_content,
      source_id: message_data['id'],
      content_attributes: build_content_attributes
    )
  end

  def determine_content_type
    case message_data['type']
    when 'text'
      :text
    when 'image'
      :image
    when 'audio'
      :audio
    when 'video'
      :video
    when 'document'
      :file
    when 'location'
      :location
    else
      :text
    end
  end

  def message_content
    case message_data['type']
    when 'text'
      message_data.dig('text', 'body')
    when 'image', 'audio', 'video', 'document'
      message_data.dig(message_data['type'], 'caption') || ''
    when 'location'
      "Location: #{message_data.dig('location', 'latitude')}, #{message_data.dig('location', 'longitude')}"
    else
      ''
    end
  end

  def build_content_attributes
    attrs = {}

    # Store context for replies
    if message_data['context'].present?
      attrs['in_reply_to'] = message_data.dig('context', 'id')
    end

    # Store media ID for non-text messages
    if message_data['type'] != 'text' && message_data[message_data['type']]['id'].present?
      attrs['media_id'] = message_data.dig(message_data['type'], 'id')
    end

    attrs
  end
end

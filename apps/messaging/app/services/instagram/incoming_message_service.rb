# Processes incoming Instagram webhook payloads (entry[].messaging[]).
# Handles text + attachment messages, business echoes (is_echo) and read receipts.
class Instagram::IncomingMessageService
  include Instagram::ContactResolution

  FILE_TYPES = {
    'image' => :image,
    'video' => :video,
    'audio' => :audio,
    'file'  => :file
  }.freeze

  # Meta media limits cap at ~25MB; bound the download to avoid memory/disk DoS.
  MAX_ATTACHMENT_SIZE = 25 * 1024 * 1024

  def initialize(inbox:, params:)
    @inbox = inbox
    @params = params
    @channel = @inbox.channel
  end

  def perform
    return unless valid_payload?

    messaging_events.each { |event| process_event(event) }
  end

  private

  def valid_payload?
    entries.present?
  end

  def entries
    @params['entry'] || @params[:entry] || []
  end

  def messaging_events
    entries.flat_map { |entry| entry['messaging'] || entry[:messaging] || [] }
  end

  def process_event(event)
    if event['message'] || event[:message]
      process_message(event.with_indifferent_access)
    elsif event['read'] || event[:read]
      process_read(event.with_indifferent_access)
    end
  end

  # --- Messages ---

  def process_message(event)
    msg = event['message']
    msg_id = msg['mid']
    echo = msg['is_echo'].present?

    # For echoes the business is the sender; the contact is the recipient.
    igsid = echo ? event.dig('recipient', 'id') : event.dig('sender', 'id')
    return if igsid.blank? || msg_id.blank?

    return if message_under_process?(msg_id)
    return if Message.exists?(source_id: msg_id)

    cache_message_source_id(msg_id)

    # Fetch the sender's name/username (best-effort) before the transaction, so the
    # contact shows a readable name instead of the raw IGSID. Skipped for echoes.
    profile = echo ? {} : maybe_fetch_profile(igsid)

    ActiveRecord::Base.transaction do
      @contact       = find_or_create_contact(igsid, profile)
      @contact_inbox = find_or_create_contact_inbox(@contact, igsid)
      @conversation  = find_or_create_conversation(@contact, @contact_inbox)

      create_message(msg, msg_id, echo)
    end
  end

  # --- Sender profile (name/username) ---

  # Only fetches when we don't already have a real name, to avoid an API call on
  # every incoming message.
  def maybe_fetch_profile(igsid)
    ci = ContactInbox.find_by(inbox: @inbox, source_id: igsid)
    return {} if ci && ci.contact.name != igsid

    fetch_sender_profile(igsid)
  end

  def fetch_sender_profile(igsid)
    response = HTTParty.get(
      "https://graph.instagram.com/#{api_version}/#{igsid}",
      query: { fields: 'name,username', access_token: @channel.valid_access_token },
      headers: { 'Accept' => 'application/json' }
    )
    parsed = response.parsed_response
    return {} unless response.success? && parsed.is_a?(Hash) && parsed['error'].blank?

    parsed
  rescue StandardError => e
    Rails.logger.warn "[Instagram] Sender profile fetch failed (#{igsid}): #{e.message}"
    {}
  end

  def api_version
    ENV.fetch('INSTAGRAM_API_VERSION', 'v22.0')
  end

  def create_message(msg, msg_id, echo)
    @message = @conversation.messages.new(
      account: @inbox.account,
      inbox: @inbox,
      sender: echo ? nil : @contact,
      message_type: echo ? :outgoing : :incoming,
      status: echo ? :delivered : :sent,
      content: msg['text'],
      source_id: msg_id
    )
    @message.skip_send_reply = true if echo

    attach_files(msg['attachments'])
    @message.save!
  end

  def attach_files(attachments)
    return if attachments.blank?

    attachments.each do |attachment|
      url = attachment.dig('payload', 'url')
      next if url.blank?

      file = Down.download(url, max_size: MAX_ATTACHMENT_SIZE, open_timeout: 5, read_timeout: 15)
      @message.attachments.new(
        account_id: @inbox.account.id,
        file_type: FILE_TYPES.fetch(attachment['type'], :file),
        file: {
          io: file,
          filename: file.original_filename,
          content_type: file.content_type
        }
      )
    rescue Down::Error => e
      Rails.logger.error "[Instagram] Attachment download failed: #{e.message}"
    end
  end

  # --- Read receipts ---

  def process_read(event)
    mid = event.dig('read', 'mid')
    return if mid.blank?

    message = Message.find_by(source_id: mid)
    return if message.blank?

    # Only advance to read; never regress a failed message.
    message.update(status: :read) if message.sent? || message.delivered?
  end

  # --- Redis deduplication ---

  def message_under_process?(source_id)
    $redis.exists?("instagram_message:#{source_id}")
  end

  def cache_message_source_id(source_id)
    $redis.setex("instagram_message:#{source_id}", 5.minutes.to_i, true)
  end
end

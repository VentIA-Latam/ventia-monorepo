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
      source_id: msg_id,
      content_attributes: content_attributes_for(msg, echo)
    )
    @message.skip_send_reply = true if echo

    attach_files(msg['attachments'])
    attach_story_reply(msg)
    @message.save!
  end

  # Builds content_attributes capturing the message origin:
  # - external_echo: business reply sent from the native Instagram app (shows agent_mobile
  #   avatar instead of the AI bot icon).
  # - reply_to_story: id of the story the contact replied to (preview media is mirrored to
  #   storage by #attach_story_reply so it survives the story's ~24h expiry).
  # - referral: ad-originated (Click-to-Instagram-Direct) context, mapped to the same shape
  #   WhatsApp uses so the chat ReferralBubble and the "Performance por anuncio" dashboard
  #   (Analytics::AdsSummaryService) pick it up channel-agnostically.
  def content_attributes_for(msg, echo)
    attrs = echo ? { external_echo: true } : {}

    story = msg.dig('reply_to', 'story')
    attrs[:reply_to_story] = { id: story['id'] } if story.present? && story['id'].present?

    referral = ad_referral_attributes(msg['referral'])
    attrs[:referral] = referral if referral

    attrs
  end

  # Maps an Instagram ads referral (source == "ADS") onto the shared referral shape.
  # ads_context_data only carries photo_url when an image was clicked, otherwise a video
  # thumbnail; Instagram provides no landing/source_url.
  def ad_referral_attributes(referral)
    return nil if referral.blank? || referral['source'] != 'ADS'

    ctx = referral['ads_context_data'] || {}
    photo_url = ctx['photo_url']
    video_url = ctx['video_url']

    {
      'source_type' => referral['source'],
      'source_id' => referral['ad_id'],
      'ref' => referral['ref'],
      'headline' => ctx['ad_title'],
      'image_url' => photo_url.presence || video_url,
      'media_type' => photo_url.present? ? 'image' : 'video'
    }
  end

  # When the message is a reply to a story, Instagram sends a signed (time-limited) CDN url.
  # Download it now and persist it as an attachment flagged via meta.story_reply, so the UI
  # can render story context even after the original story expires.
  def attach_story_reply(msg)
    story = msg.dig('reply_to', 'story')
    return if story.blank?

    url = story['url']
    return if url.blank?

    file = Down.download(url, max_size: MAX_ATTACHMENT_SIZE, open_timeout: 5, read_timeout: 15)
    @message.attachments.new(
      account_id: @inbox.account.id,
      file_type: story_file_type(file.content_type),
      meta: { story_reply: true, story_id: story['id'] },
      file: {
        io: file,
        filename: file.original_filename,
        content_type: file.content_type
      }
    )
  rescue Down::Error => e
    # Keep the message (and the reply_to_story id) even if the preview can't be downloaded.
    Rails.logger.warn "[Instagram] Story reply download failed (#{story['id']}): #{e.message}"
  end

  def story_file_type(content_type)
    content_type.to_s.start_with?('video') ? :video : :image
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

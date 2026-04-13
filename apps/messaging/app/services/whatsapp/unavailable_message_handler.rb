class Whatsapp::UnavailableMessageHandler
  include Whatsapp::ContactResolution

  AUTO_REPLY_TEXT = 'Hola, ¿cómo podemos ayudarte?'.freeze

  def initialize(inbox:, message_data:, contacts_data:)
    @inbox = inbox
    @message_data = message_data
    @contacts_data = contacts_data
  end

  def perform
    phone = @message_data['from'] || @message_data[:from]
    msg_id = @message_data['id'] || @message_data[:id]

    return if message_under_process?(msg_id)
    return if Message.exists?(source_id: msg_id)

    cache_message_source_id(msg_id)

    contact_info = find_contact_info(phone)
    referral = @message_data['referral'] || @message_data[:referral]

    Rails.logger.warn(
      "[WhatsApp][131060] Unavailable message received - " \
      "contact=#{phone} wamid=#{msg_id} inbox=#{@inbox.id} " \
      "account=#{@inbox.account_id} has_referral=#{referral.present?}"
    )

    ActiveRecord::Base.transaction do
      @contact = find_or_create_contact(phone, contact_info)
      contact_inbox = find_or_create_contact_inbox(@contact, phone)
      @conversation = find_or_create_conversation(@contact, contact_inbox)

      create_placeholder_message(msg_id, referral)
    end

    send_auto_reply if @conversation.ai_agent_enabled?
  end

  private

  def find_contact_info(wa_id)
    @contacts_data.find do |c|
      (c['wa_id'] || c[:wa_id]) == wa_id
    end || {}
  end

  def create_placeholder_message(msg_id, referral)
    content_attrs = {
      'is_unavailable' => true,
      'unavailable_reason' => '131060',
      'unavailable_title' => 'This message is unavailable',
      'wa_message_type' => 'unsupported'
    }

    if referral.present?
      content_attrs['referral'] = {
        'source_url' => referral['source_url'] || referral[:source_url],
        'source_type' => referral['source_type'] || referral[:source_type],
        'source_id' => referral['source_id'] || referral[:source_id],
        'headline' => referral['headline'] || referral[:headline],
        'body' => referral['body'] || referral[:body],
        'media_type' => referral['media_type'] || referral[:media_type],
        'image_url' => referral['image_url'] || referral[:image_url]
      }.compact
    end

    @conversation.messages.create!(
      account: @inbox.account,
      inbox: @inbox,
      sender: @contact,
      message_type: :incoming,
      status: :sent,
      content_type: :text,
      content: '',
      source_id: msg_id,
      content_attributes: content_attrs
    )
  end

  def send_auto_reply
    @conversation.messages.create!(
      account: @inbox.account,
      inbox: @inbox,
      sender: nil,
      message_type: :outgoing,
      content_type: :text,
      content: AUTO_REPLY_TEXT,
      content_attributes: {
        'automated' => true,
        'automated_reason' => 'unavailable_message_recovery'
      }
    )
  end

  def message_under_process?(source_id)
    $redis.exists?("whatsapp_message:#{source_id}")
  end

  def cache_message_source_id(source_id)
    $redis.setex("whatsapp_message:#{source_id}", 5.minutes.to_i, true)
  end
end

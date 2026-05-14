class Campaigns::TriggerService
  def initialize(campaign:)
    @campaign = campaign
  end

  def perform
    return unless @campaign.can_trigger?

    process_audience
    @campaign.update!(campaign_status: :completed)
  rescue StandardError => e
    Rails.logger.error "[Campaign] Trigger failed for campaign #{@campaign.id}: #{e.message}"
    raise
  end

  private

  def process_audience
    audience_contacts.find_each do |contact|
      create_campaign_conversation(contact)
    end
  end

  def audience_contacts
    # If audience is specified, use it. Otherwise, send to all contacts with phone OR BSUID
    if @campaign.audience.present?
      filter_audience_contacts
    else
      base = @campaign.account.contacts
      base.where.not(phone_number: nil).or(base.where.not(identifier: nil))
    end
  end

  def filter_audience_contacts
    # Audience format: [{ "filter_operator": "equal_to", "attribute_key": "phone_number", "values": ["+123..."] }]
    base_scope = @campaign.account.contacts
                          .where.not(phone_number: nil)
                          .or(@campaign.account.contacts.where.not(identifier: nil))

    @campaign.audience.reduce(base_scope) do |scope, filter|
      apply_filter(scope, filter)
    end
  end

  def apply_filter(scope, filter)
    attribute = filter['attribute_key']
    operator = filter['filter_operator']
    values = filter['values']

    case operator
    when 'equal_to'
      scope.where(attribute => values)
    when 'not_equal_to'
      scope.where.not(attribute => values)
    when 'contains'
      scope.where("#{attribute} LIKE ?", "%#{values.first}%")
    else
      scope
    end
  end

  def create_campaign_conversation(contact)
    # BSUID si hay, teléfono como fallback (solo dígitos para Meta API)
    source_id = contact.identifier.presence || contact.phone_number&.gsub(/[^\d]/, '')

    contact_inbox = ContactInbox.find_or_create_by!(
      contact:   contact,
      inbox:     @campaign.inbox,
      source_id: source_id
    ) do |ci|
      ci.user_id = contact.identifier if contact.identifier.present?
    end

    # Create conversation
    conversation = Conversation.create!(
      account: @campaign.account,
      inbox: @campaign.inbox,
      contact: contact,
      contact_inbox: contact_inbox,
      campaign: @campaign,
      status: :open
    )

    # Create and send message
    message = Message.create!(
      account: @campaign.account,
      inbox: @campaign.inbox,
      conversation: conversation,
      message_type: :outgoing,
      content_type: :text,
      content: @campaign.message
    )

    # Send via WhatsApp
    Whatsapp::SendOnWhatsappService.new(
      conversation: conversation,
      message: message
    ).perform

  rescue StandardError => e
    Rails.logger.error "[Campaign] Failed to send to #{contact.phone_number || contact.identifier}: #{e.message}"
  end
end

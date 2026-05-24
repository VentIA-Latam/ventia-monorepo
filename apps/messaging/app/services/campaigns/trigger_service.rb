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
    if @campaign.audience.present?
      filter_audience_contacts
    else
      reachable_contacts
    end
  end

  def reachable_contacts
    # Use subquery IDs to keep both branches structurally compatible for #or.
    ids_with_phone = @campaign.account.contacts.where.not(phone_number: nil).select(:id)
    ids_with_bsuid = ContactInbox
                       .where(inbox: @campaign.inbox)
                       .where.not(whatsapp_bsuid: nil)
                       .select(:contact_id)

    @campaign.account.contacts.where(id: ids_with_phone).or(
      @campaign.account.contacts.where(id: ids_with_bsuid)
    )
  end

  def filter_audience_contacts
    # Audience format: [{ "filter_operator": "equal_to", "attribute_key": "phone_number", "values": ["+123..."] }]
    @campaign.audience.reduce(reachable_contacts) do |scope, filter|
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
    existing_ci = ContactInbox
                    .where(contact: contact, inbox: @campaign.inbox)
                    .order(Arel.sql('whatsapp_bsuid IS NULL ASC'))
                    .first
    bsuid     = existing_ci&.whatsapp_bsuid
    source_id = bsuid.presence || contact.phone_number&.gsub(/[^\d]/, '')

    if source_id.blank?
      Rails.logger.warn "[Campaign] Contact #{contact.id} has no whatsapp_bsuid nor phone, skipping"
      return
    end

    contact_inbox = ContactInbox.find_or_create_by!(
      contact:   contact,
      inbox:     @campaign.inbox,
      source_id: source_id
    ) do |ci|
      ci.whatsapp_bsuid = bsuid if bsuid.present?
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
    Rails.logger.error "[Campaign] Failed to send to #{contact.phone_number || bsuid}: #{e.message}"
  end
end

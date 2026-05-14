module Whatsapp::ContactResolution
  def find_or_create_contact(phone, bsuid, contact_info)
    name = contact_info.dig('profile', 'name') || contact_info.dig(:profile, :name)

    contact = find_existing_contact(phone, bsuid)
    if contact
      enrich_contact_identifiers(contact, phone, bsuid)
      return contact
    end

    Contact.create!(
      account:      @inbox.account,
      name:         name || bsuid || phone,
      phone_number: phone.present? ? "+#{phone}" : nil,
      identifier:   bsuid.presence
    )
  end

  def find_or_create_contact_inbox(contact, phone, bsuid)
    if bsuid.present?
      ci = ContactInbox.find_by(inbox: @inbox, user_id: bsuid)
      return ci if ci
    end

    source = bsuid.presence || phone
    ContactInbox.find_or_create_by!(
      contact:   contact,
      inbox:     @inbox,
      source_id: source
    ) do |ci|
      ci.user_id = bsuid if bsuid.present?
    end
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
      account:       @inbox.account,
      inbox:         @inbox,
      contact:       contact,
      contact_inbox: contact_inbox,
      status:        :open
    )
  end

  private

  def find_existing_contact(phone, bsuid)
    if bsuid.present?
      found = Contact.find_by(account: @inbox.account, identifier: bsuid)
      return found if found
    end

    if phone.present?
      found = Contact.find_by(account: @inbox.account, phone_number: "+#{phone}")
      return found if found
    end

    nil
  end

  def enrich_contact_identifiers(contact, phone, bsuid)
    updates = {}
    updates[:phone_number] = "+#{phone}" if phone.present? && contact.phone_number.blank?
    updates[:identifier]   = bsuid       if bsuid.present? && contact.identifier.blank?
    contact.update!(updates) if updates.any?
  end
end

module Whatsapp::ContactResolution
  def find_or_create_contact(phone, bsuid, contact_info)
    name = contact_info.dig('profile', 'name') || contact_info.dig(:profile, :name)

    # Prioridad 1: contact_inbox por BSUID (scoped al inbox, alineado con Chatwoot upstream)
    if bsuid.present?
      ci = ContactInbox.find_by(inbox: @inbox, whatsapp_bsuid: bsuid)
      if ci
        enrich_contact_phone(ci.contact, phone)
        return ci.contact
      end
    end

    # Prioridad 2: contacto por teléfono (fallback legacy)
    if phone.present?
      contact = Contact.find_by(account: @inbox.account, phone_number: "+#{phone}")
      return contact if contact
    end

    # Prioridad 3: crear nuevo contacto (sin tocar contacts.identifier — es campo CRM)
    Contact.create!(
      account:      @inbox.account,
      name:         name || bsuid || phone,
      phone_number: phone.present? ? "+#{phone}" : nil
    )
  end

  def find_or_create_contact_inbox(contact, phone, bsuid)
    if bsuid.present?
      ci = ContactInbox.find_by(inbox: @inbox, whatsapp_bsuid: bsuid)
      return ci if ci
    end

    source = bsuid.presence || phone
    ContactInbox.find_or_create_by!(
      contact:   contact,
      inbox:     @inbox,
      source_id: source
    ) do |ci|
      ci.whatsapp_bsuid = bsuid if bsuid.present?
    end
  rescue ActiveRecord::RecordNotUnique
    ContactInbox.find_by!(inbox: @inbox, whatsapp_bsuid: bsuid)
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

  def enrich_contact_phone(contact, phone)
    return if phone.blank? || contact.phone_number.present?
    contact.update!(phone_number: "+#{phone}")
  end
end

module Whatsapp::ContactResolution
  def find_or_create_contact(phone, bsuid, contact_info)
    raise ArgumentError, 'Cannot resolve contact: phone and bsuid both blank' if phone.blank? && bsuid.blank?

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
    return nil if phone.blank? && bsuid.blank?

    # Prioridad 1: match exacto por bsuid (identidad estable)
    if bsuid.present?
      ci = ContactInbox.find_by(inbox: @inbox, whatsapp_bsuid: bsuid)
      return ci if ci
    end

    # Prioridad 2: CI legacy del mismo (contact, inbox) — enriquecer en vez de duplicar
    existing = ContactInbox.where(contact: contact, inbox: @inbox).order(:created_at).first
    if existing
      existing.update!(whatsapp_bsuid: bsuid) if bsuid.present? && existing.whatsapp_bsuid.blank?
      return existing
    end

    # Prioridad 3: crear nuevo
    source = bsuid.presence || phone
    ContactInbox.create!(
      contact:        contact,
      inbox:          @inbox,
      source_id:      source,
      whatsapp_bsuid: bsuid
    )
  rescue ActiveRecord::RecordNotUnique
    ContactInbox.find_by(inbox: @inbox, whatsapp_bsuid: bsuid) ||
      ContactInbox.find_by(inbox: @inbox, source_id: source)
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

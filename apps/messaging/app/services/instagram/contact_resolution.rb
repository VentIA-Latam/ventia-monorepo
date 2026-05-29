module Instagram::ContactResolution
  # Resolves (or creates) the contact for an Instagram-scoped user id (IGSID).
  # The IGSID is stored on contact_inboxes.source_id, never on contacts.identifier
  # (which is reserved for CRM usage — same convention as Whatsapp::ContactResolution).
  def find_or_create_contact(igsid, profile = {})
    display_name = profile['name'].presence || profile['username'].presence
    ci = ContactInbox.find_by(inbox: @inbox, source_id: igsid)

    if ci
      contact = ci.contact
      # Only set the name when the contact is still labeled with the raw IGSID,
      # so we don't clobber a manually edited or previously enriched name.
      contact.update!(name: display_name) if display_name.present? && contact.name == igsid
      merge_profile_attributes(contact, profile)
      return contact
    end

    Contact.create!(
      account: @inbox.account,
      name: display_name.presence || igsid,
      additional_attributes: contact_attributes(profile)
    )
  end

  def find_or_create_contact_inbox(contact, igsid)
    ContactInbox.find_or_create_by!(inbox: @inbox, source_id: igsid) do |ci|
      ci.contact = contact
    end
  rescue ActiveRecord::RecordNotUnique
    ContactInbox.find_by(inbox: @inbox, source_id: igsid)
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

  def merge_profile_attributes(contact, profile)
    attrs = contact_attributes(profile)
    contact.update!(additional_attributes: contact.additional_attributes.merge(attrs)) if attrs.present?
  end

  def contact_attributes(profile)
    {
      'social_instagram_username' => profile['username'],
      'social_instagram_profile_picture_url' => profile['profile_picture_url']
    }.compact
  end
end

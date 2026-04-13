module Whatsapp::ContactResolution
  def find_or_create_contact(phone, contact_info)
    name = contact_info.dig('profile', 'name') || contact_info.dig(:profile, :name) || phone

    Contact.find_or_create_by!(
      account: @inbox.account,
      phone_number: "+#{phone}"
    ) do |contact|
      contact.name = name
    end
  end

  def find_or_create_contact_inbox(contact, source_id)
    ContactInbox.find_or_create_by!(
      contact: contact,
      inbox: @inbox,
      source_id: source_id
    )
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
      account: @inbox.account,
      inbox: @inbox,
      contact: contact,
      contact_inbox: contact_inbox,
      status: :open
    )
  end
end

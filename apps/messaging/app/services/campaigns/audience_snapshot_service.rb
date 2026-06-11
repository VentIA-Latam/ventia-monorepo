# Toma una campaña + label_ids y crea recipients (uno por contacto único con phone E.164
# que tenga al menos una conversación etiquetada con alguno de los labels indicados).
#
# Importante en este codebase: los labels viven en Conversation, no en Contact. El query
# va via conversations → contacts.
#
# Side effect (solo permitido en campaign.draft?):
# - Borra los recipients existentes de la campaña.
# - Crea N nuevos con vars: {}, status: :pending.
#
# Output: cantidad de recipients creados.
class Campaigns::AudienceSnapshotService
  class CampaignNotDraftError < StandardError; end
  class NoValidContactsError  < StandardError; end

  def initialize(campaign:, label_ids:)
    @campaign  = campaign
    @label_ids = Array(label_ids).map(&:to_i).reject(&:zero?)
  end

  def perform
    raise CampaignNotDraftError, 'audience snapshot solo permitido en campaign :draft' unless @campaign.draft?

    Campaign.transaction do
      @campaign.campaign_recipients.delete_all
      contacts = eligible_contacts
      contacts.find_each do |contact|
        @campaign.campaign_recipients.create!(
          contact: contact,
          phone:   contact.phone_number,
          vars:    {},
          status:  :pending
        )
      end
      count = @campaign.campaign_recipients.count
      @campaign.update!(
        audience_type:    :labels,
        recipients_count: count,
        audience:         @label_ids.map { |id| { 'id' => id, 'type' => 'Label' } }
      )
      count
    end
  end

  private

  def eligible_contacts
    @campaign.account.contacts
      .joins(conversations: :labels)
      .where(labels: { id: @label_ids })
      .where.not(phone_number: nil)
      .distinct
  end
end

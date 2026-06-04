# == Schema Information
#
# Table name: messaging.campaign_recipients
#
#  id              :bigint           not null, primary key
#  campaign_id     :bigint           not null
#  contact_id      :bigint                                # nullable hasta primer envío
#  phone           :string           not null             # E.164
#  vars            :jsonb            default({})          # valores por columna del CSV
#  conversation_id :bigint                                # no FK formal
#  message_id      :bigint                                # no FK formal
#  status          :integer          default(0), not null # pending=0 queued=1 sent=2 delivered=3 read=4 failed=5 omitted=6
#  external_error  :text
#  sent_at         :datetime
#  delivered_at    :datetime
#  read_at         :datetime
#  created_at      :datetime         not null
#  updated_at      :datetime         not null
#
# Indexes
#
#  index_campaign_recipients_on_campaign_id_and_status  (campaign_id, status)
#  index_campaign_recipients_on_campaign_id_and_phone   (campaign_id, phone) UNIQUE
#  index_campaign_recipients_on_message_id              (message_id) WHERE message_id IS NOT NULL
#

class CampaignRecipient < ApplicationRecord
  belongs_to :campaign
  belongs_to :contact, optional: true

  enum :status, {
    pending: 0, queued: 1, sent: 2, delivered: 3, read: 4, failed: 5, omitted: 6
  }

  validates :phone, presence: true,
            format: { with: Conversations::EnsureFromPhoneService::E164_REGEX }
  validates :phone, uniqueness: { scope: :campaign_id }

  # Scopes para CompletionChecker y dashboards
  scope :terminal, -> { where(status: [:sent, :delivered, :read, :failed, :omitted]) }
  scope :pending_or_queued, -> { where(status: [:pending, :queued]) }
end

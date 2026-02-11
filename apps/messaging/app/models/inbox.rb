# == Schema Information
#
# Table name: messaging.inboxes
#
#  id                            :uuid             not null, primary key
#  name                          :string           not null
#  channel_type                  :string           not null
#  channel_id                    :uuid             not null
#  account_id                    :uuid             not null
#  greeting_enabled              :boolean          default(FALSE)
#  greeting_message              :string
#  enable_auto_assignment        :boolean          default(TRUE)
#  auto_assignment_config        :jsonb            default({})
#  allow_messages_after_resolved :boolean          default(TRUE)
#  lock_to_single_conversation   :boolean          default(FALSE)
#  working_hours_enabled         :boolean          default(FALSE)
#  out_of_office_message         :string
#  timezone                      :string           default("UTC")
#  created_at                    :datetime         not null
#  updated_at                    :datetime         not null
#
# Indexes
#
#  index_inboxes_on_account_id                   (account_id)
#  index_inboxes_on_channel_id_and_channel_type  (channel_id, channel_type)
#

class Inbox < ApplicationRecord
  # Validations
  validates :name, presence: true
  validates :account_id, presence: true
  validates :channel_type, presence: true
  validates :channel_id, presence: true
  validates :timezone, inclusion: { in: TZInfo::Timezone.all_identifiers }

  # Associations
  belongs_to :account
  belongs_to :channel, polymorphic: true, dependent: :destroy

  has_many :contact_inboxes, dependent: :destroy
  has_many :contacts, through: :contact_inboxes
  has_many :conversations, dependent: :destroy
  has_many :messages, dependent: :destroy
  has_many :campaigns, dependent: :destroy
  has_many :webhooks, dependent: :destroy
  has_many :inbox_members, dependent: :destroy
  has_many :members, through: :inbox_members, source: :user
  has_one :agent_bot_inbox, dependent: :destroy
  has_one :agent_bot, through: :agent_bot_inbox

  # Callbacks
  after_create_commit :dispatch_create_event
  after_update_commit :dispatch_update_event

  # Scopes
  scope :order_by_name, -> { order('lower(name) ASC') }

  # Channel type helpers
  def whatsapp?
    channel_type == 'Channel::Whatsapp'
  end

  def api?
    channel_type == 'Channel::Api'
  end

  def callback_webhook_url
    if whatsapp?
      Rails.application.routes.url_helpers.api_v1_whatsapp_webhooks_url(
        inbox_id: id,
        host: ENV.fetch('FRONTEND_URL', 'http://localhost:3000')
      )
    end
  end

  private

  def dispatch_create_event
    Rails.logger.info "Inbox created: #{id}"
    # Wisper.broadcast(:inbox_created, self)
  end

  def dispatch_update_event
    Rails.logger.info "Inbox updated: #{id}"
    # Wisper.broadcast(:inbox_updated, self)
  end
end

# == Schema Information
#
# Table name: messaging.conversations
#
#  id                     :uuid             not null, primary key
#  uuid                   :uuid             not null
#  status                 :integer          default("open")
#  priority               :integer          default("low")
#  additional_attributes  :jsonb            default({})
#  custom_attributes      :jsonb            default({})
#  last_activity_at       :datetime         not null
#  contact_last_seen_at   :datetime
#  agent_last_seen_at     :datetime
#  first_reply_created_at :datetime
#  waiting_since          :datetime
#  snoozed_until          :datetime
#  account_id             :uuid             not null
#  inbox_id               :uuid             not null
#  contact_id             :uuid             not null
#  contact_inbox_id       :uuid             not null
#  assignee_id            :uuid
#  team_id                :uuid
#  campaign_id            :uuid
#  assignee_agent_bot_id  :uuid
#  created_at             :datetime         not null
#  updated_at             :datetime         not null
#
# Indexes
#
#  index_conversations_on_account_id      (account_id)
#  index_conversations_on_inbox_id        (inbox_id)
#  index_conversations_on_contact_id      (contact_id)
#  index_conversations_on_uuid            (uuid) UNIQUE
#  index_conversations_on_status          (status)
#

class Conversation < ApplicationRecord
  include AASM
  include Wisper::Publisher
  include AssignmentHandler
  include AutoAssignmentHandler

  # Validations
  validates :account_id, presence: true
  validates :inbox_id, presence: true
  validates :contact_id, presence: true
  validates :contact_inbox_id, presence: true
  validates :uuid, presence: true, uniqueness: true

  # Associations
  belongs_to :account
  belongs_to :inbox
  belongs_to :contact
  belongs_to :contact_inbox
  belongs_to :campaign, optional: true
  belongs_to :assignee_agent_bot, class_name: 'AgentBot', optional: true

  has_many :messages, dependent: :destroy
  has_many :conversation_labels, dependent: :destroy
  has_many :labels, through: :conversation_labels

  # Enums
  enum :status, { open: 0, resolved: 1, pending: 2, snoozed: 3 }
  enum :priority, { low: 0, medium: 1, high: 2, urgent: 3 }

  # Scopes
  scope :unassigned, -> { where(assignee_id: nil) }
  scope :assigned, -> { where.not(assignee_id: nil) }
  scope :recent, -> { order(last_activity_at: :desc) }

  # Callbacks
  before_validation :ensure_uuid
  before_validation :set_initial_status, on: :create
  after_create_commit :broadcast_created
  after_update_commit :broadcast_updated
  after_update_commit :broadcast_status_changed, if: :saved_change_to_status?

  # State machine
  aasm column: :status, enum: true do
    state :open, initial: true
    state :resolved
    state :pending
    state :snoozed

    event :toggle_status do
      transitions from: :open, to: :resolved
      transitions from: :resolved, to: :open
    end

    event :snooze do
      transitions from: :open, to: :snoozed
    end

    event :resolve do
      transitions to: :resolved
    end

    event :reopen do
      transitions to: :open
    end
  end

  def last_activity_at
    self[:last_activity_at] || created_at
  end

  def last_incoming_message
    messages.incoming.last
  end

  def last_outgoing_message
    messages.outgoing.last
  end

  def unread_messages
    messages.unread
  end

  def can_reply?
    Conversations::MessageWindowService.new(self).can_reply?
  end

  def webhook_data
    {
      id: id,
      uuid: uuid,
      status: status,
      account_id: account_id,
      inbox_id: inbox_id,
      contact_id: contact_id,
      assignee_id: assignee_id,
      team_id: team_id,
      additional_attributes: additional_attributes
    }
  end

  private

  def ensure_uuid
    self.uuid ||= SecureRandom.uuid
  end

  def set_initial_status
    self.status ||= :open
    self.last_activity_at ||= Time.current
  end

  def broadcast_created
    Rails.logger.info "[Event] Conversation #{id} created"
    broadcast(:conversation_created, data: { conversation: self })
  end

  def broadcast_updated
    Rails.logger.info "[Event] Conversation #{id} updated"
    broadcast(:conversation_updated, data: { conversation: self, changed_attributes: saved_changes })
  end

  def broadcast_status_changed
    Rails.logger.info "[Event] Conversation #{id} status changed to #{status}"
    broadcast(:conversation_status_changed, data: { conversation: self })
  end
end

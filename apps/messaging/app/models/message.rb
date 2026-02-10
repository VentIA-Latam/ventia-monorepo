# == Schema Information
#
# Table name: messaging.messages
#
#  id                        :uuid             not null, primary key
#  content                   :text
#  message_type              :integer          not null
#  content_type              :integer          default("text")
#  status                    :integer          default("sent")
#  private                   :boolean          default(FALSE)
#  sender_type               :string
#  sender_id                 :uuid
#  source_id                 :string
#  content_attributes        :jsonb            default({})
#  additional_attributes     :jsonb            default({})
#  processed_message_content :text
#  account_id                :uuid             not null
#  inbox_id                  :uuid             not null
#  conversation_id           :uuid             not null
#  created_at                :datetime         not null
#  updated_at                :datetime         not null
#
# Indexes
#
#  index_messages_on_account_id        (account_id)
#  index_messages_on_conversation_id   (conversation_id)
#  index_messages_on_inbox_id          (inbox_id)
#  index_messages_on_sender            (sender_type, sender_id)
#  index_messages_on_source_id         (source_id)
#

class Message < ApplicationRecord
  include Wisper::Publisher

  MAX_CONTENT_LENGTH = 150_000

  # Validations
  validates :account_id, presence: true
  validates :inbox_id, presence: true
  validates :conversation_id, presence: true
  validates :message_type, presence: true
  validates :content_type, presence: true
  validates :content, length: { maximum: MAX_CONTENT_LENGTH }

  # Associations
  belongs_to :account
  belongs_to :inbox
  belongs_to :conversation
  belongs_to :sender, polymorphic: true, optional: true

  # Enums
  enum :message_type, { incoming: 0, outgoing: 1, activity: 2, template: 3 }
  enum :content_type, {
    text: 0,
    image: 1,
    audio: 2,
    video: 3,
    file: 4,
    location: 5,
    sticker: 6,
    template: 7
  }
  enum :status, { sent: 0, delivered: 1, read: 2, failed: 3 }

  # Store accessors
  store_accessor :content_attributes,
                 :template_params,
                 :in_reply_to,
                 :external_created_at,
                 :external_error

  # Callbacks
  before_save :ensure_processed_message_content
  after_create_commit :broadcast_created
  after_update_commit :broadcast_updated, if: :saved_change_to_status?

  # Scopes
  scope :chat, -> { where.not(message_type: :activity).where(private: false) }
  scope :incoming, -> { where(message_type: :incoming) }
  scope :outgoing, -> { where(message_type: :outgoing) }
  scope :unread, -> { where.not(status: :read) }
  scope :recent, -> { order(created_at: :desc) }

  def inbound?
    incoming? || template?
  end

  def outbound?
    outgoing? && !private?
  end

  def webhook_data
    {
      id: id,
      content: content,
      message_type: message_type,
      content_type: content_type,
      status: status,
      created_at: created_at.to_i,
      conversation_id: conversation_id,
      sender: sender&.webhook_data
    }
  end

  private

  def ensure_processed_message_content
    self.processed_message_content = content if processed_message_content.blank?
  end

  def broadcast_created
    Rails.logger.info "[Event] Message #{id} created for conversation #{conversation_id}"
    broadcast(:message_created, data: { message: self })
  end

  def broadcast_updated
    Rails.logger.info "[Event] Message #{id} updated: status=#{status}"
    broadcast(:message_updated, data: { message: self, changed_attributes: saved_changes })
  end
end

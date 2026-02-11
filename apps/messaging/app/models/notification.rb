# == Schema Information
#
# Table name: messaging.notifications
#
#  id                   :uuid             not null, primary key
#  account_id           :uuid             not null
#  user_id              :uuid             not null
#  notification_type    :integer          not null
#  primary_actor_type   :string           not null
#  primary_actor_id     :uuid             not null
#  secondary_actor_type :string
#  secondary_actor_id   :uuid
#  read_at              :datetime
#  snoozed_until        :datetime
#  last_activity_at     :datetime
#  meta                 :jsonb            default({})
#  created_at           :datetime         not null
#  updated_at           :datetime         not null
#

class Notification < ApplicationRecord
  include Wisper::Publisher

  belongs_to :account
  belongs_to :user
  belongs_to :primary_actor, polymorphic: true
  belongs_to :secondary_actor, polymorphic: true, optional: true

  enum :notification_type, {
    conversation_creation: 1,
    conversation_assignment: 2,
    assigned_conversation_new_message: 3,
    participating_conversation_new_message: 4
  }

  scope :unread, -> { where(read_at: nil) }
  scope :read, -> { where.not(read_at: nil) }
  scope :unsnoozed, -> { where('snoozed_until IS NULL OR snoozed_until < ?', Time.zone.now) }
  scope :recent, -> { order(last_activity_at: :desc) }

  before_create :set_last_activity_at
  after_create_commit :broadcast_notification_created
  after_update_commit :broadcast_notification_updated
  after_destroy_commit :broadcast_notification_deleted

  def push_event_data
    {
      id: id,
      notification_type: notification_type,
      primary_actor_type: primary_actor_type,
      primary_actor_id: primary_actor_id,
      primary_actor: primary_actor&.webhook_data,
      secondary_actor: secondary_actor&.push_event_data,
      read_at: read_at,
      snoozed_until: snoozed_until,
      last_activity_at: last_activity_at,
      account_id: account_id,
      created_at: created_at
    }
  end

  private

  def set_last_activity_at
    self.last_activity_at = Time.zone.now
  end

  def broadcast_notification_created
    broadcast(:notification_created, data: { notification: self })
  end

  def broadcast_notification_updated
    broadcast(:notification_updated, data: { notification: self })
  end

  def broadcast_notification_deleted
    broadcast(:notification_deleted, data: {
      notification_data: { id: id, user_id: user_id, account_id: account_id }
    })
  end
end

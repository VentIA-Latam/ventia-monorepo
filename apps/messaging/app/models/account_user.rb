# == Schema Information
#
# Table name: messaging.account_users
#
#  id           :bigint           not null, primary key
#  account_id   :bigint           not null
#  user_id      :bigint           not null
#  role         :integer          default("agent")
#  availability :integer          default("online")
#  auto_offline :boolean          default(TRUE)
#  active_at    :datetime
#  created_at   :datetime         not null
#  updated_at   :datetime         not null
#

class AccountUser < ApplicationRecord
  belongs_to :account
  belongs_to :user

  enum :role, { agent: 0, administrator: 1 }
  enum :availability, { online: 0, offline: 1, busy: 2 }

  validates :user_id, uniqueness: { scope: :account_id }

  after_create_commit :create_default_notification_setting
  after_save :update_presence_in_redis, if: :saved_change_to_availability?

  def push_event_data
    {
      id: id,
      role: role,
      availability: availability,
      user_id: user_id,
      user: user.push_event_data
    }
  end

  private

  def create_default_notification_setting
    notification_settings = user.notification_settings.find_or_initialize_by(account_id: account_id)
    notification_settings.save!
  end

  def update_presence_in_redis
    OnlineStatusTracker.set_status(account_id, user_id, availability)
  end
end

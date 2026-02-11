# == Schema Information
#
# Table name: messaging.notification_settings
#
#  id          :uuid             not null, primary key
#  account_id  :uuid             not null
#  user_id     :uuid             not null
#  email_flags :integer          default(0), not null
#  push_flags  :integer          default(0), not null
#  created_at  :datetime         not null
#  updated_at  :datetime         not null
#

class NotificationSetting < ApplicationRecord
  belongs_to :account
  belongs_to :user

  validates :user_id, uniqueness: { scope: :account_id }

  # Bitmask flags for email notifications
  # Bit 1: conversation_creation
  # Bit 2: conversation_assignment
  # Bit 4: assigned_conversation_new_message
  # Bit 8: participating_conversation_new_message

  FLAGS = {
    conversation_creation: 1,
    conversation_assignment: 2,
    assigned_conversation_new_message: 4,
    participating_conversation_new_message: 8
  }.freeze

  def email_enabled?(flag_name)
    flag_value = FLAGS[flag_name.to_sym]
    return false unless flag_value

    (email_flags & flag_value) != 0
  end

  def push_enabled?(flag_name)
    flag_value = FLAGS[flag_name.to_sym]
    return false unless flag_value

    (push_flags & flag_value) != 0
  end

  def enable_email!(flag_name)
    flag_value = FLAGS[flag_name.to_sym]
    return unless flag_value

    update!(email_flags: email_flags | flag_value)
  end

  def enable_push!(flag_name)
    flag_value = FLAGS[flag_name.to_sym]
    return unless flag_value

    update!(push_flags: push_flags | flag_value)
  end

  def disable_email!(flag_name)
    flag_value = FLAGS[flag_name.to_sym]
    return unless flag_value

    update!(email_flags: email_flags & ~flag_value)
  end

  def disable_push!(flag_name)
    flag_value = FLAGS[flag_name.to_sym]
    return unless flag_value

    update!(push_flags: push_flags & ~flag_value)
  end

  # Set defaults for new account users
  def self.create_default_for(user:, account:)
    setting = find_or_initialize_by(user: user, account: account)
    # Default: email + push for conversation_assignment
    setting.email_flags = FLAGS[:conversation_assignment]
    setting.push_flags = FLAGS[:conversation_assignment]
    setting.save!
    setting
  end
end

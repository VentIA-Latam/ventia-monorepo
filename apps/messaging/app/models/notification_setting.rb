# == Schema Information
#
# Table name: messaging.notification_settings
#
#  id          :bigint           not null, primary key
#  account_id  :bigint           not null
#  user_id     :bigint           not null
#  email_flags :integer          default(3), not null
#  push_flags  :integer          default(7), not null
#  created_at  :datetime         not null
#  updated_at  :datetime         not null
#

class NotificationSetting < ApplicationRecord
  belongs_to :account
  belongs_to :user

  validates :user_id, uniqueness: { scope: :account_id }

  # Bitmask flags — aplican a push_flags y email_flags de forma independiente
  # Bit 1: human_support  — conversación derivada a soporte humano (push + email)
  # Bit 2: payment_review — pago pendiente de validar              (push + email)
  # Bit 4: message_ai_off — mensaje nuevo con IA desactivada       (solo push)
  # Bit 8: message_ai_on  — mensaje nuevo con IA activada          (solo push)

  FLAGS = {
    human_support: 1,
    payment_review: 2,
    message_ai_off: 4,
    message_ai_on: 8
  }.freeze

  DEFAULT_PUSH_FLAGS  = FLAGS[:human_support] | FLAGS[:payment_review] | FLAGS[:message_ai_off] # 7
  DEFAULT_EMAIL_FLAGS = FLAGS[:human_support] | FLAGS[:payment_review] # 3

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

  def push_flags_hash
    FLAGS.transform_values { |bit| (push_flags & bit) != 0 }
  end

  def email_flags_hash
    FLAGS.transform_values { |bit| (email_flags & bit) != 0 }
  end

  def self.create_default_for(user:, account:)
    find_or_create_by!(user: user, account: account) do |s|
      s.email_flags = DEFAULT_EMAIL_FLAGS
      s.push_flags = DEFAULT_PUSH_FLAGS
    end
  rescue ActiveRecord::RecordNotUnique
    find_by!(user: user, account: account)
  end
end

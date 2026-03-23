# == Schema Information
#
# Table name: messaging.push_subscription_tokens
#
#  id          :bigint           not null, primary key
#  user_id     :bigint           not null
#  account_id  :bigint           not null
#  token       :text             not null
#  platform    :integer          default("web"), not null
#  device_info :jsonb            default({})
#  created_at  :datetime         not null
#  updated_at  :datetime         not null
#
# Indexes
#
#  index_push_subscription_tokens_on_user_id_and_token  (user_id, token) UNIQUE
#  index_push_subscription_tokens_on_account_id         (account_id)
#

class PushSubscriptionToken < ApplicationRecord
  # Enums
  enum :platform, { web: 0, android: 1, ios: 2 }

  # Validations
  validates :token, presence: true, uniqueness: { scope: :user_id }
  validates :user_id, presence: true
  validates :account_id, presence: true

  # Associations
  belongs_to :user
  belongs_to :account

  # Scopes
  scope :for_account, ->(account_id) { where(account_id: account_id) }
  scope :for_users, ->(user_ids) { where(user_id: user_ids) }
  scope :excluding_users, ->(user_ids) { where.not(user_id: user_ids) }

  def token_data
    {
      id: id,
      token: token,
      platform: platform,
      device_info: device_info,
      user_id: user_id
    }
  end
end

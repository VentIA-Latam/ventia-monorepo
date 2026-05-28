# == Schema Information
#
# Table name: messaging.channel_instagram
#
#  id               :bigint           not null, primary key
#  instagram_id     :string           not null
#  username         :string
#  access_token     :text             not null
#  token_expires_at :datetime
#  provider_config  :jsonb            default({})
#  account_id       :bigint           not null
#  created_at       :datetime         not null
#  updated_at       :datetime         not null
#
# Indexes
#
#  index_channel_instagram_on_instagram_id  (instagram_id) UNIQUE
#  index_channel_instagram_on_account_id    (account_id)
#

class Channel::Instagram < ApplicationRecord
  include Reauthorizable

  self.table_name = 'channel_instagram'

  AUTHORIZATION_ERROR_THRESHOLD = 1

  validates :instagram_id, presence: true, uniqueness: true
  validates :access_token, presence: true
  validates :account_id, presence: true

  belongs_to :account
  has_one :inbox, as: :channel, dependent: :destroy

  def name
    'Instagram'
  end

  def provider_service
    @provider_service ||= ::Instagram::Providers::GraphApiService.new(instagram_channel: self)
  end

  delegate :send_message, to: :provider_service

  # Returns a valid (refreshed if necessary) long-lived access token.
  def valid_access_token
    ::Instagram::RefreshOauthTokenService.new(channel: self).access_token
  end
end

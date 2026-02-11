# == Schema Information
#
# Table name: messaging.users
#
#  id                :uuid             not null, primary key
#  ventia_user_id    :uuid             not null
#  name              :string           not null
#  email             :string           not null
#  avatar_url        :string
#  pubsub_token      :string
#  custom_attributes :jsonb            default({})
#  created_at        :datetime         not null
#  updated_at        :datetime         not null
#

class User < ApplicationRecord
  # Validations
  validates :ventia_user_id, presence: true, uniqueness: true
  validates :name, presence: true
  validates :email, presence: true, format: { with: URI::MailTo::EMAIL_REGEXP }
  validates :pubsub_token, uniqueness: true, allow_nil: true

  # Associations
  has_many :account_users, dependent: :destroy
  has_many :accounts, through: :account_users

  has_many :assigned_conversations, foreign_key: 'assignee_id', class_name: 'Conversation', dependent: :nullify, inverse_of: :assignee
  has_many :conversation_participants, dependent: :destroy
  has_many :participating_conversations, through: :conversation_participants, source: :conversation

  has_many :inbox_members, dependent: :destroy
  has_many :inboxes, through: :inbox_members

  has_many :team_members, dependent: :destroy
  has_many :teams, through: :team_members

  has_many :notifications, dependent: :destroy
  has_many :notification_settings, dependent: :destroy

  has_many :messages, as: :sender, dependent: :nullify

  # Callbacks
  before_create :ensure_pubsub_token
  before_validation :normalize_email

  # Scopes
  scope :order_by_name, -> { order('lower(name) ASC') }

  def push_event_data
    {
      id: id,
      name: name,
      email: email,
      avatar_url: avatar_url,
      type: 'user'
    }
  end

  def webhook_data
    {
      id: id,
      name: name,
      email: email,
      ventia_user_id: ventia_user_id
    }
  end

  private

  def ensure_pubsub_token
    self.pubsub_token ||= SecureRandom.urlsafe_base64(16)
  end

  def normalize_email
    self.email = email.downcase if email.present?
  end
end

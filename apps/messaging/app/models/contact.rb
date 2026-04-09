# == Schema Information
#
# Table name: messaging.contacts
#
#  id                    :bigint           not null, primary key
#  name                  :string           default("")
#  email                 :string
#  phone_number          :string
#  identifier            :string
#  additional_attributes :jsonb            default({})
#  custom_attributes     :jsonb            default({})
#  contact_type          :integer          default("visitor")
#  blocked               :boolean          default(FALSE)
#  last_activity_at      :datetime
#  account_id            :bigint           not null
#  created_at            :datetime         not null
#  updated_at            :datetime         not null
#
# Indexes
#
#  index_contacts_on_account_id                (account_id)
#  index_contacts_on_email_and_account_id      (email, account_id) UNIQUE
#  index_contacts_on_phone_number_and_account  (phone_number, account_id) UNIQUE
#  index_contacts_on_identifier_and_account    (identifier, account_id) UNIQUE
#

class Contact < ApplicationRecord
  # Validations
  validates :account_id, presence: true
  validates :email,
            allow_blank: true,
            uniqueness: { scope: [:account_id], case_sensitive: false },
            format: { with: URI::MailTo::EMAIL_REGEXP }
  validates :identifier, allow_blank: true, uniqueness: { scope: [:account_id] }
  validates :phone_number,
            allow_blank: true,
            uniqueness: { scope: [:account_id] },
            format: { with: /\A\+[1-9]\d{1,14}\z/ }

  # Associations
  belongs_to :account
  has_many :contact_inboxes, dependent: :destroy
  has_many :inboxes, through: :contact_inboxes
  has_many :conversations, dependent: :destroy
  has_many :messages, as: :sender, dependent: :destroy

  # Enums
  enum :contact_type, { visitor: 0, lead: 1, customer: 2 }

  # Callbacks
  before_validation :prepare_contact_attributes
  after_create_commit :dispatch_create_event
  after_update_commit :dispatch_update_event

  # Scopes
  scope :order_on_last_activity_at, ->(direction = 'DESC') { order(last_activity_at: direction) }
  scope :order_on_created_at, ->(direction = 'DESC') { order(created_at: direction) }

  def get_source_id(inbox_id)
    contact_inboxes.find_by(inbox_id: inbox_id)&.source_id
  end

  def webhook_data
    {
      id: id,
      name: name,
      email: email,
      phone_number: phone_number,
      identifier: identifier,
      type: contact_type,
      additional_attributes: additional_attributes,
      custom_attributes: custom_attributes
    }
  end

  private

  def prepare_contact_attributes
    self.phone_number = phone_number&.gsub(/[^\d+]/, '')
    self.email = email&.downcase&.strip if email.present?
    self.name = name&.strip if name.present?
  end

  def dispatch_create_event
    Rails.logger.info "Contact created: #{id}"
  end

  def dispatch_update_event
    Rails.logger.info "Contact updated: #{id}"
  end
end

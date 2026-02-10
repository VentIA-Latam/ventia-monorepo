# == Schema Information
#
# Table name: messaging.accounts
#
#  id                    :uuid             not null, primary key
#  name                  :string           not null
#  locale                :string           default("en")
#  status                :integer          default("active")
#  settings              :jsonb            default({})
#  limits                :jsonb            default({})
#  ventia_tenant_id      :uuid             # Reference to ventia.tenants
#  created_at            :datetime         not null
#  updated_at            :datetime         not null
#
# Indexes
#
#  index_accounts_on_status           (status)
#  index_accounts_on_ventia_tenant_id (ventia_tenant_id)
#

class Account < ApplicationRecord
  # Settings accessors
  store_accessor :settings, :auto_resolve_after, :auto_resolve_message

  # Validations
  validates :name, presence: true
  validates :ventia_tenant_id, presence: true

  # Associations
  has_many :inboxes, dependent: :destroy
  has_many :contacts, dependent: :destroy
  has_many :conversations, dependent: :destroy
  has_many :messages, dependent: :destroy
  has_many :labels, dependent: :destroy
  has_many :campaigns, dependent: :destroy
  has_many :automation_rules, dependent: :destroy
  has_many :agent_bots, dependent: :destroy
  has_many :webhooks, dependent: :destroy
  has_many :whatsapp_channels, dependent: :destroy, class_name: 'Channel::Whatsapp'

  # Enums
  enum :status, { active: 0, suspended: 1 }

  # Scopes
  scope :active, -> { where(status: :active) }
  scope :for_tenant, ->(tenant_id) { where(ventia_tenant_id: tenant_id) }

  # Callbacks
  after_create_commit :notify_creation

  def webhook_data
    {
      id: id,
      name: name,
      ventia_tenant_id: ventia_tenant_id
    }
  end

  def usage_limits
    limits.presence || {
      inboxes: 10,
      contacts: 10_000,
      campaigns: 50
    }
  end

  private

  def notify_creation
    # Broadcast account created event
    Rails.logger.info "Account created: #{id}"
  end
end

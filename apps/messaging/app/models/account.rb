# == Schema Information
#
# Table name: messaging.accounts
#
#  id                    :bigint           not null, primary key
#  name                  :string           not null
#  locale                :string           default("en")
#  status                :integer          default("active")
#  settings              :jsonb            default({})
#  limits                :jsonb            default({})
#  ventia_tenant_id      :integer          # Reference to ventia.tenants
#  created_at            :datetime         not null
#  updated_at            :datetime         not null
#
# Indexes
#
#  index_accounts_on_status           (status)
#  index_accounts_on_ventia_tenant_id (ventia_tenant_id)
#

class Account < ApplicationRecord
  ALLOWED_TEMPERATURE_COLORS = %w[
    #1f93ff #4CAF50 #FF9800 #E91E63
    #9C27B0 #00BCD4 #795548 #607D8B
  ].freeze

  ALLOWED_TEMPERATURE_ICONS = %w[
    snowflake thermometer flame sun moon star heart zap
    cloud droplets wind target circle square triangle diamond
    sparkles rocket leaf skull
  ].freeze

  MAX_TEMPERATURES = 5

  # Settings accessors
  store_accessor :settings, :auto_resolve_after, :auto_resolve_message

  # Validations
  validates :name, presence: true
  validates :ventia_tenant_id, presence: true
  validate :validate_temperature_config

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
  has_many :push_subscription_tokens, dependent: :destroy
  has_many :whatsapp_channels, dependent: :destroy, class_name: 'Channel::Whatsapp'
  has_many :account_users, dependent: :destroy
  has_many :users, through: :account_users
  has_many :teams, dependent: :destroy
  has_many :canned_responses, dependent: :destroy
  has_many :notifications, dependent: :destroy

  # Enums
  enum :status, { active: 0, suspended: 1 }

  # Scopes
  scope :active, -> { where(status: :active) }
  scope :for_tenant, ->(tenant_id) { where(ventia_tenant_id: tenant_id) }

  # Callbacks
  after_create_commit :notify_creation
  after_create_commit :create_system_labels

  def webhook_data
    {
      id: id,
      name: name,
      ventia_tenant_id: ventia_tenant_id
    }
  end

  def valid_temperature_keys
    (temperature_config || []).map { |t| t["key"] }
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
    Rails.logger.info "Account created: #{id}"
  end

  def validate_temperature_config
    config = temperature_config
    return if config.blank?

    unless config.is_a?(Array)
      errors.add(:temperature_config, "must be an array")
      return
    end

    if config.length > MAX_TEMPERATURES
      errors.add(:temperature_config, "cannot have more than #{MAX_TEMPERATURES} temperatures")
      return
    end

    keys = []
    config.each_with_index do |entry, idx|
      unless entry.is_a?(Hash)
        errors.add(:temperature_config, "entry #{idx} must be a hash")
        next
      end

      key = entry["key"]
      if key.blank? || !key.match?(/\A[a-z0-9_]+\z/)
        errors.add(:temperature_config, "entry #{idx} key must be snake_case")
      elsif keys.include?(key)
        errors.add(:temperature_config, "entry #{idx} has duplicate key '#{key}'")
      end
      keys << key

      errors.add(:temperature_config, "entry #{idx} name is required") if entry["name"].blank?

      if entry["color"].blank?
        errors.add(:temperature_config, "entry #{idx} color is required")
      elsif !ALLOWED_TEMPERATURE_COLORS.include?(entry["color"])
        errors.add(:temperature_config, "entry #{idx} has invalid color '#{entry['color']}'")
      end

      if entry["icon"].blank?
        errors.add(:temperature_config, "entry #{idx} icon is required")
      elsif !ALLOWED_TEMPERATURE_ICONS.include?(entry["icon"])
        errors.add(:temperature_config, "entry #{idx} has invalid icon '#{entry['icon']}'")
      end

      unless entry["position"].is_a?(Integer)
        errors.add(:temperature_config, "entry #{idx} position must be an integer")
      end
    end
  end

  def create_system_labels
    Label::SYSTEM_LABEL_NAMES.each do |title|
      labels.find_or_create_by!(title: title) do |label|
        label.color = title == 'soporte-humano' ? '#E91E63' : '#FF9800'
        label.system = true
      end
    end
    Rails.logger.info "System labels created for account #{id}"
  rescue StandardError => e
    Rails.logger.error "Failed to create system labels for account #{id}: #{e.message}"
  end
end

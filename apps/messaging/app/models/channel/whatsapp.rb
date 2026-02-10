# == Schema Information
#
# Table name: messaging.channel_whatsapp
#
#  id                             :uuid             not null, primary key
#  phone_number                   :string           not null
#  provider                       :string           default("whatsapp_cloud")
#  provider_config                :jsonb            default({})
#  message_templates              :jsonb            default([])
#  message_templates_last_updated :datetime
#  account_id                     :uuid             not null
#  created_at                     :datetime         not null
#  updated_at                     :datetime         not null
#
# Indexes
#
#  index_channel_whatsapp_on_phone_number  (phone_number) UNIQUE
#  index_channel_whatsapp_on_account_id    (account_id)
#

class Channel::Whatsapp < ApplicationRecord
  self.table_name = 'channel_whatsapp'

  PROVIDERS = %w[whatsapp_cloud].freeze
  EDITABLE_ATTRS = [:phone_number, :provider, { provider_config: {} }].freeze

  # Validations
  validates :phone_number, presence: true, uniqueness: true
  validates :provider, inclusion: { in: PROVIDERS }
  validates :account_id, presence: true
  validate :validate_provider_config

  # Associations
  belongs_to :account
  has_one :inbox, as: :channel, dependent: :destroy

  # Callbacks
  before_validation :ensure_webhook_verify_token
  after_create :sync_templates
  after_create :setup_webhooks, if: :should_auto_setup_webhooks?
  before_destroy :teardown_webhooks

  def name
    'WhatsApp'
  end

  def provider_service
    @provider_service ||= Whatsapp::Providers::WhatsappCloudService.new(whatsapp_channel: self)
  end

  # Delegate to provider service
  delegate :send_message, to: :provider_service
  delegate :send_template, to: :provider_service
  delegate :sync_templates, to: :provider_service
  delegate :media_url, to: :provider_service
  delegate :api_headers, to: :provider_service
  delegate :validate_provider_config?, to: :provider_service

  def mark_message_templates_updated
    update_column(:message_templates_last_updated, Time.zone.now)
  end

  def setup_webhooks
    business_account_id = provider_config['business_account_id']
    api_key = provider_config['api_key']

    Whatsapp::WebhookSetupService.new(self, business_account_id, api_key).perform
  rescue StandardError => e
    Rails.logger.error "[WHATSAPP] Webhook setup failed: #{e.message}"
    raise
  end

  private

  def ensure_webhook_verify_token
    provider_config['webhook_verify_token'] ||= SecureRandom.hex(16)
  end

  def validate_provider_config
    return if provider_config.blank?

    unless validate_provider_config?
      errors.add(:provider_config, 'Invalid credentials')
    end
  end

  def teardown_webhooks
    Whatsapp::WebhookTeardownService.new(self).perform
  rescue StandardError => e
    Rails.logger.error "[WHATSAPP] Webhook teardown failed: #{e.message}"
  end

  def should_auto_setup_webhooks?
    provider == 'whatsapp_cloud' && provider_config['source'] != 'embedded_signup'
  end
end

# == Schema Information
#
# Table name: messaging.campaigns
#
#  id              :bigint           not null, primary key
#  title           :string           not null
#  message         :text
#  campaign_type   :integer          default("one_off")
#  campaign_status :integer          default("active")
#  enabled         :boolean          default(TRUE)
#  audience        :jsonb            default([])
#  scheduled_at    :datetime
#  triggered_at    :datetime
#  account_id      :bigint           not null
#  inbox_id        :bigint           not null
#  sender_id       :bigint
#  created_at      :datetime         not null
#  updated_at      :datetime         not null
#
# Indexes
#
#  index_campaigns_on_account_id       (account_id)
#  index_campaigns_on_inbox_id         (inbox_id)
#  index_campaigns_on_campaign_status  (campaign_status)
#

class Campaign < ApplicationRecord
  include Wisper::Publisher

  # Validations
  validates :title, presence: true
  validates :account_id, presence: true
  validates :inbox_id, presence: true
  validate :inbox_must_be_whatsapp

  # Associations
  belongs_to :account
  belongs_to :inbox
  has_many :conversations, dependent: :nullify

  # Enums
  enum :campaign_type, { one_off: 0, ongoing: 1 }
  enum :campaign_status, { active: 0, completed: 1, paused: 2 }

  # Scopes
  scope :enabled, -> { where(enabled: true) }
  scope :scheduled, -> { where.not(scheduled_at: nil) }
  scope :pending, -> { where(campaign_status: :active, enabled: true).where('scheduled_at <= ?', Time.current) }

  # Callbacks
  before_validation :set_default_values
  after_update_commit :broadcast_status_changed, if: :saved_change_to_campaign_status?

  def trigger!
    return unless can_trigger?

    update!(triggered_at: Time.current)
    broadcast(:campaign_triggered, data: { campaign: self })
    Campaigns::TriggerService.new(campaign: self).perform
  end

  def pause!
    update!(campaign_status: :paused)
  end

  def resume!
    update!(campaign_status: :active)
  end

  def can_trigger?
    active? && enabled? && !triggered_at.present?
  end

  def webhook_data
    {
      id: id,
      title: title,
      message: message,
      campaign_type: campaign_type,
      campaign_status: campaign_status,
      scheduled_at: scheduled_at,
      triggered_at: triggered_at
    }
  end

  private

  def set_default_values
    self.campaign_type ||= :one_off
    self.scheduled_at ||= Time.current if one_off?
  end

  def inbox_must_be_whatsapp
    return unless inbox

    unless inbox.whatsapp?
      errors.add(:inbox, 'must be a WhatsApp inbox')
    end
  end

  def broadcast_status_changed
    Rails.logger.info "[Event] Campaign #{id} status changed to #{campaign_status}"
    broadcast(:campaign_status_changed, data: { campaign: self })
  end
end

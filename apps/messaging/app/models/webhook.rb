# == Schema Information
#
# Table name: messaging.webhooks
#
#  id            :uuid             not null, primary key
#  url           :string           not null
#  subscriptions :jsonb            default([])
#  account_id    :uuid             not null
#  inbox_id      :uuid
#  created_at    :datetime         not null
#  updated_at    :datetime         not null
#
# Indexes
#
#  index_webhooks_on_account_id  (account_id)
#  index_webhooks_on_inbox_id    (inbox_id)
#

class Webhook < ApplicationRecord
  ALLOWED_EVENTS = %w[
    conversation_created
    conversation_updated
    conversation_status_changed
    message_created
    message_updated
    contact_created
    contact_updated
  ].freeze

  # Validations
  validates :url, presence: true, format: URI::DEFAULT_PARSER.make_regexp(%w[http https])
  validates :account_id, presence: true
  validates :url, uniqueness: { scope: [:account_id] }
  validate :validate_subscriptions

  # Associations
  belongs_to :account
  belongs_to :inbox, optional: true

  # Callbacks
  after_create_commit :dispatch_create_event

  def dispatch_event(event_name, data)
    return unless subscriptions.include?(event_name)

    Webhooks::DeliverJob.perform_later(
      webhook_id: id,
      event_name: event_name,
      data: data
    )
  end

  def webhook_data
    {
      id: id,
      url: url,
      subscriptions: subscriptions
    }
  end

  private

  def validate_subscriptions
    return if subscriptions.blank?

    unless subscriptions.is_a?(Array)
      errors.add(:subscriptions, 'must be an array')
      return
    end

    invalid = subscriptions - ALLOWED_EVENTS
    if invalid.any?
      errors.add(:subscriptions, "invalid events: #{invalid.join(', ')}")
    end
  end

  def dispatch_create_event
    Rails.logger.info "Webhook #{id} created for account #{account_id}"
  end
end

class NotificationBuilder
  attr_reader :notification_type, :user, :account, :primary_actor, :secondary_actor

  def initialize(notification_type:, user:, account:, primary_actor:, secondary_actor: nil)
    @notification_type = notification_type
    @user = user
    @account = account
    @primary_actor = primary_actor
    @secondary_actor = secondary_actor
  end

  def perform
    return unless user_subscribed?

    notification = user.notifications.find_or_initialize_by(
      account_id: account.id,
      notification_type: notification_type,
      primary_actor: primary_actor
    )

    if notification.new_record?
      notification.secondary_actor = secondary_actor
      notification.save!
    else
      notification.update!(
        secondary_actor: secondary_actor,
        last_activity_at: Time.zone.now,
        read_at: nil
      )
    end

    notification
  rescue ActiveRecord::RecordInvalid => e
    Rails.logger.error "[NotificationBuilder] Failed: #{e.message}"
    nil
  end

  private

  def user_subscribed?
    setting = user.notification_settings.find_by(account_id: account.id)
    return true if setting.blank? # Default to enabled if no settings

    setting.email_enabled?(notification_type) || setting.push_enabled?(notification_type)
  end
end

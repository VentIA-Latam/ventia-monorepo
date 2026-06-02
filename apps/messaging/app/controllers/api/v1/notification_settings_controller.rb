class Api::V1::NotificationSettingsController < Api::V1::BaseController
  # Flags con template de email; el resto solo existe como push.
  EMAIL_CAPABLE_FLAGS = %i[human_support payment_review].freeze

  def show
    setting = find_or_create_setting
    render_success({
      push_flags: setting.push_flags_hash,
      email_flags: setting.email_flags_hash
    })
  end

  def update
    setting = find_or_create_setting
    channel = params.dig(:notification_settings, :channel).presence
    flags = params.require(:notification_settings).permit(*NotificationSetting::FLAGS.keys)

    new_push_flags = setting.push_flags
    new_email_flags = setting.email_flags

    flags.each do |flag_name, enabled|
      flag_value = NotificationSetting::FLAGS[flag_name.to_sym]
      next unless flag_value

      enabled_bool = ActiveModel::Type::Boolean.new.cast(enabled)
      target = channel || legacy_channel_for(flag_name.to_sym)

      if target == 'email'
        # human_support y payment_review son los únicos con email; el resto se ignora.
        next unless EMAIL_CAPABLE_FLAGS.include?(flag_name.to_sym)

        new_email_flags = toggle_bit(new_email_flags, flag_value, enabled_bool)
      else
        new_push_flags = toggle_bit(new_push_flags, flag_value, enabled_bool)
      end
    end

    setting.update!(push_flags: new_push_flags, email_flags: new_email_flags)
    setting.reload
    render_success({
      push_flags: setting.push_flags_hash,
      email_flags: setting.email_flags_hash
    })
  end

  private

  def toggle_bit(flags, bit, enabled)
    enabled ? (flags | bit) : (flags & ~bit)
  end

  # Compatibilidad: si el cliente no envía channel, se usa el ruteo histórico por nombre.
  def legacy_channel_for(flag_name)
    EMAIL_CAPABLE_FLAGS.include?(flag_name) ? 'email' : 'push'
  end

  def find_or_create_setting
    user = current_account.account_users
             .joins(:user)
             .where(users: { ventia_user_id: request.headers['X-User-Id'] })
             .first&.user

    raise ActiveRecord::RecordNotFound, 'User not found' unless user

    NotificationSetting.create_default_for(user: user, account: current_account)
  end
end

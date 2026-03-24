class Api::V1::NotificationSettingsController < Api::V1::BaseController
  def show
    setting = find_or_create_setting
    render_success({ push_flags: setting.push_flags_hash })
  end

  def update
    setting = find_or_create_setting
    flags = params.require(:notification_settings).permit(*NotificationSetting::FLAGS.keys)

    new_push_flags = setting.push_flags
    flags.each do |flag_name, enabled|
      flag_value = NotificationSetting::FLAGS[flag_name.to_sym]
      next unless flag_value

      if ActiveModel::Type::Boolean.new.cast(enabled)
        new_push_flags |= flag_value
      else
        new_push_flags &= ~flag_value
      end
    end

    setting.update!(push_flags: new_push_flags)
    render_success({ push_flags: setting.reload.push_flags_hash })
  end

  private

  def find_or_create_setting
    user = current_account.account_users
             .joins(:user)
             .where(users: { ventia_user_id: request.headers['X-User-Id'] })
             .first&.user

    raise ActiveRecord::RecordNotFound, 'User not found' unless user

    NotificationSetting.find_or_create_by!(user: user, account: current_account) do |s|
      s.push_flags = NotificationSetting::DEFAULT_PUSH_FLAGS
    end
  end
end

class UpdateNotificationSettingsPushFlagsDefault < ActiveRecord::Migration[7.2]
  def up
    change_column_default :notification_settings, :push_flags, 7
    # Migrate existing rows from old Chatwoot flags to new VentIA defaults
    execute "UPDATE notification_settings SET push_flags = 7 WHERE push_flags = 0"
  end

  def down
    change_column_default :notification_settings, :push_flags, 0
  end
end

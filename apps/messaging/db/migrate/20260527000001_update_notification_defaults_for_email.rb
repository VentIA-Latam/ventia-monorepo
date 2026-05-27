class UpdateNotificationDefaultsForEmail < ActiveRecord::Migration[7.2]
  def up
    change_column_default :notification_settings, :push_flags, 4
    change_column_default :notification_settings, :email_flags, 3

    execute <<-SQL
      UPDATE notification_settings
      SET push_flags = push_flags & ~3,
          email_flags = email_flags | 3
    SQL
  end

  def down
    change_column_default :notification_settings, :push_flags, 7
    change_column_default :notification_settings, :email_flags, 0

    execute <<-SQL
      UPDATE notification_settings
      SET push_flags = push_flags | 3,
          email_flags = email_flags & ~3
    SQL
  end
end

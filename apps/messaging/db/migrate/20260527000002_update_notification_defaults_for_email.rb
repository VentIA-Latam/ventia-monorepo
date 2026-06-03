class UpdateNotificationDefaultsForEmail < ActiveRecord::Migration[7.2]
  def up
    change_column_default :notification_settings, :push_flags, 4
    change_column_default :notification_settings, :email_flags, 3

    execute "UPDATE #{quoted_table} SET push_flags = push_flags & ~3, email_flags = email_flags | 3"
  end

  def down
    change_column_default :notification_settings, :push_flags, 7
    change_column_default :notification_settings, :email_flags, 0

    execute "UPDATE #{quoted_table} SET push_flags = push_flags | 3, email_flags = email_flags & ~3"
  end

  private

  def quoted_table
    ActiveRecord::Base.connection.quote_table_name(
      NotificationSetting.table_name
    )
  end
end

class RestorePushFlagsForHumanSupportPaymentReview < ActiveRecord::Migration[7.2]
  def up
    change_column_default :notification_settings, :push_flags, 7
    execute "UPDATE #{quoted_table} SET push_flags = push_flags | 3"
  end

  def down
    change_column_default :notification_settings, :push_flags, 4
    execute "UPDATE #{quoted_table} SET push_flags = push_flags & ~3"
  end

  private

  def quoted_table
    ActiveRecord::Base.connection.quote_table_name(
      NotificationSetting.table_name
    )
  end
end

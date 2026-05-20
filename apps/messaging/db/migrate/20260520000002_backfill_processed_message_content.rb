class BackfillProcessedMessageContent < ActiveRecord::Migration[7.2]
  def up
    execute <<~SQL
      UPDATE messages
      SET processed_message_content = content
      WHERE processed_message_content IS NULL AND content IS NOT NULL
    SQL
  end

  def down
    # irreversible — backfilled data is safe to keep
  end
end

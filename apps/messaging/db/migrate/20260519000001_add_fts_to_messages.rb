class AddFtsToMessages < ActiveRecord::Migration[7.2]
  def up
    execute <<~SQL
      ALTER TABLE messages
        ADD COLUMN message_search_ts tsvector
        GENERATED ALWAYS AS (
          to_tsvector('spanish', coalesce(processed_message_content, ''))
        ) STORED;
    SQL

    add_index :messages, :message_search_ts, using: :gin,
              name: 'index_messages_on_message_search_ts'
  end

  def down
    remove_index :messages, name: 'index_messages_on_message_search_ts'

    execute 'ALTER TABLE messages DROP COLUMN message_search_ts;'
  end
end

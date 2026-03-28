class CreatePushSubscriptionTokens < ActiveRecord::Migration[7.2]
  def change
    create_table :push_subscription_tokens, id: :uuid, default: -> { "gen_random_uuid()" }, if_not_exists: true do |t|
      t.references :user, null: false, foreign_key: true, type: :uuid
      t.references :account, null: false, foreign_key: true, type: :uuid
      t.text :token, null: false
      t.integer :platform, default: 0, null: false
      t.jsonb :device_info, default: {}
      t.timestamps
    end

    unless index_exists?(:push_subscription_tokens, [:user_id, :token])
      add_index :push_subscription_tokens, [:user_id, :token], unique: true
    end

    unless column_exists?(:accounts, :notify_ai_messages)
      add_column :accounts, :notify_ai_messages, :boolean, default: false, null: false
    end
  end
end

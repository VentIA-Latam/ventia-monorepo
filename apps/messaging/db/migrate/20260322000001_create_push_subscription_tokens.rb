class CreatePushSubscriptionTokens < ActiveRecord::Migration[7.2]
  def change
    create_table :push_subscription_tokens do |t|
      t.references :user, null: false, foreign_key: true
      t.references :account, null: false, foreign_key: true
      t.text :token, null: false
      t.integer :platform, default: 0, null: false
      t.jsonb :device_info, default: {}
      t.timestamps
    end

    add_index :push_subscription_tokens, [:user_id, :token], unique: true

    add_column :accounts, :notify_ai_messages, :boolean, default: false, null: false
  end
end

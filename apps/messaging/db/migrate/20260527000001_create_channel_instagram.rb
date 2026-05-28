class CreateChannelInstagram < ActiveRecord::Migration[7.2]
  def change
    create_table :channel_instagram do |t|
      t.string   :instagram_id, null: false
      t.string   :username
      t.text     :access_token, null: false
      t.datetime :token_expires_at
      t.jsonb    :provider_config, default: {}
      t.bigint   :account_id, null: false

      t.timestamps
    end

    add_index :channel_instagram, :instagram_id, unique: true
    add_index :channel_instagram, :account_id
    add_foreign_key :channel_instagram, :accounts, column: :account_id
  end
end

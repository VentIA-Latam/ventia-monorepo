class AddUserManagementAndAssignments < ActiveRecord::Migration[7.2]
  def up
    # Users table (synced from Ventia)
    create_table :users, id: :uuid do |t|
      t.uuid :ventia_user_id, null: false
      t.string :name, null: false
      t.string :email, null: false
      t.string :avatar_url
      t.string :pubsub_token
      t.jsonb :custom_attributes, default: {}

      t.timestamps
    end

    add_index :users, :ventia_user_id, unique: true
    add_index :users, :pubsub_token, unique: true
    add_index :users, :email

    # AccountUsers (join table with role/availability)
    create_table :account_users, id: :uuid do |t|
      t.uuid :account_id, null: false
      t.uuid :user_id, null: false
      t.integer :role, default: 0, null: false
      t.integer :availability, default: 0, null: false
      t.boolean :auto_offline, default: true, null: false
      t.datetime :active_at

      t.timestamps
    end

    add_index :account_users, [:account_id, :user_id], unique: true
    add_foreign_key :account_users, :accounts, column: :account_id
    add_foreign_key :account_users, :users, column: :user_id

    # Teams
    create_table :teams, id: :uuid do |t|
      t.uuid :account_id, null: false
      t.string :name, null: false
      t.text :description
      t.boolean :allow_auto_assign, default: true

      t.timestamps
    end

    add_index :teams, [:account_id, :name], unique: true
    add_foreign_key :teams, :accounts

    # TeamMembers
    create_table :team_members, id: :uuid do |t|
      t.uuid :team_id, null: false
      t.uuid :user_id, null: false

      t.timestamps
    end

    add_index :team_members, [:team_id, :user_id], unique: true
    add_foreign_key :team_members, :teams
    add_foreign_key :team_members, :users

    # InboxMembers (controls inbox access + round-robin)
    create_table :inbox_members, id: :uuid do |t|
      t.uuid :inbox_id, null: false
      t.uuid :user_id, null: false

      t.timestamps
    end

    add_index :inbox_members, [:inbox_id, :user_id], unique: true
    add_foreign_key :inbox_members, :inboxes
    add_foreign_key :inbox_members, :users

    # ConversationParticipants
    create_table :conversation_participants, id: :uuid do |t|
      t.uuid :account_id, null: false
      t.uuid :conversation_id, null: false
      t.uuid :user_id, null: false

      t.timestamps
    end

    add_index :conversation_participants, [:conversation_id, :user_id], unique: true
    add_foreign_key :conversation_participants, :accounts
    add_foreign_key :conversation_participants, :conversations
    add_foreign_key :conversation_participants, :users

    # Attachments
    create_table :attachments, id: :uuid do |t|
      t.uuid :account_id, null: false
      t.uuid :message_id, null: false
      t.integer :file_type, default: 0
      t.string :external_url
      t.string :extension
      t.float :coordinates_lat, default: 0.0
      t.float :coordinates_long, default: 0.0
      t.jsonb :meta, default: {}

      t.timestamps
    end

    add_index :attachments, :account_id
    add_index :attachments, :message_id
    add_foreign_key :attachments, :accounts
    add_foreign_key :attachments, :messages

    # Notifications
    create_table :notifications, id: :uuid do |t|
      t.uuid :account_id, null: false
      t.uuid :user_id, null: false
      t.integer :notification_type, null: false
      t.string :primary_actor_type, null: false
      t.uuid :primary_actor_id, null: false
      t.string :secondary_actor_type
      t.uuid :secondary_actor_id
      t.datetime :read_at
      t.datetime :snoozed_until
      t.datetime :last_activity_at
      t.jsonb :meta, default: {}

      t.timestamps
    end

    add_index :notifications, [:user_id, :account_id, :read_at]
    add_index :notifications, [:primary_actor_type, :primary_actor_id]
    add_foreign_key :notifications, :accounts
    add_foreign_key :notifications, :users

    # NotificationSettings (bitmask flags)
    create_table :notification_settings, id: :uuid do |t|
      t.uuid :account_id, null: false
      t.uuid :user_id, null: false
      t.integer :email_flags, default: 0, null: false
      t.integer :push_flags, default: 0, null: false

      t.timestamps
    end

    add_index :notification_settings, [:account_id, :user_id], unique: true
    add_foreign_key :notification_settings, :accounts
    add_foreign_key :notification_settings, :users

    # CannedResponses
    create_table :canned_responses, id: :uuid do |t|
      t.uuid :account_id, null: false
      t.string :short_code, null: false
      t.text :content, null: false

      t.timestamps
    end

    add_index :canned_responses, [:account_id, :short_code], unique: true
    add_foreign_key :canned_responses, :accounts

    # Add foreign keys to existing conversations table for assignee and team
    add_foreign_key :conversations, :users, column: :assignee_id
    add_foreign_key :conversations, :teams, column: :team_id
    add_index :conversations, :assignee_id
    add_index :conversations, :team_id

  end

  def down
    remove_foreign_key :conversations, column: :assignee_id
    remove_foreign_key :conversations, column: :team_id
    remove_index :conversations, :assignee_id, if_exists: true
    remove_index :conversations, :team_id, if_exists: true

    drop_table :canned_responses, if_exists: true
    drop_table :notification_settings, if_exists: true
    drop_table :notifications, if_exists: true
    drop_table :attachments, if_exists: true
    drop_table :conversation_participants, if_exists: true
    drop_table :inbox_members, if_exists: true
    drop_table :team_members, if_exists: true
    drop_table :teams, if_exists: true
    drop_table :account_users, if_exists: true
    drop_table :users, if_exists: true
  end
end

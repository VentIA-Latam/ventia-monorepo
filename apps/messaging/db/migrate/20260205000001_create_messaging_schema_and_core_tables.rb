class CreateMessagingSchemaAndCoreTables < ActiveRecord::Migration[7.2]
  def up
    # Create messaging schema
    execute "CREATE SCHEMA IF NOT EXISTS messaging"

    # Enable UUID extension if not already enabled
    enable_extension 'pgcrypto' unless extension_enabled?('pgcrypto')

    # Set search path to include messaging schema
    execute "SET search_path TO messaging, public"

    # Accounts table
    create_table :accounts, id: :uuid do |t|
      t.string :name, null: false
      t.string :locale, default: 'en'
      t.integer :status, default: 0, null: false
      t.jsonb :settings, default: {}
      t.jsonb :limits, default: {}
      t.uuid :ventia_tenant_id, null: false

      t.timestamps
    end

    add_index :accounts, :status
    add_index :accounts, :ventia_tenant_id, unique: true

    # Channel WhatsApp table
    create_table :channel_whatsapp, id: :uuid do |t|
      t.string :phone_number, null: false
      t.string :provider, default: 'whatsapp_cloud'
      t.jsonb :provider_config, default: {}
      t.jsonb :message_templates, default: []
      t.datetime :message_templates_last_updated
      t.uuid :account_id, null: false

      t.timestamps
    end

    add_index :channel_whatsapp, :phone_number, unique: true
    add_index :channel_whatsapp, :account_id
    add_foreign_key :channel_whatsapp, :accounts, column: :account_id

    # Inboxes table
    create_table :inboxes, id: :uuid do |t|
      t.string :name, null: false
      t.string :channel_type, null: false
      t.uuid :channel_id, null: false
      t.uuid :account_id, null: false
      t.boolean :greeting_enabled, default: false
      t.string :greeting_message
      t.boolean :enable_auto_assignment, default: true
      t.jsonb :auto_assignment_config, default: {}
      t.boolean :allow_messages_after_resolved, default: true
      t.boolean :lock_to_single_conversation, default: false
      t.boolean :working_hours_enabled, default: false
      t.string :out_of_office_message
      t.string :timezone, default: 'UTC'

      t.timestamps
    end

    add_index :inboxes, :account_id
    add_index :inboxes, [:channel_id, :channel_type]
    add_foreign_key :inboxes, :accounts, column: :account_id

    # Contacts table
    create_table :contacts, id: :uuid do |t|
      t.string :name, default: ''
      t.string :email
      t.string :phone_number
      t.string :identifier
      t.jsonb :additional_attributes, default: {}
      t.jsonb :custom_attributes, default: {}
      t.integer :contact_type, default: 0
      t.boolean :blocked, default: false
      t.datetime :last_activity_at
      t.uuid :account_id, null: false

      t.timestamps
    end

    add_index :contacts, :account_id
    add_index :contacts, [:email, :account_id], unique: true, where: "email IS NOT NULL AND email != ''"
    add_index :contacts, [:phone_number, :account_id], unique: true, where: "phone_number IS NOT NULL AND phone_number != ''"
    add_index :contacts, [:identifier, :account_id], unique: true, where: "identifier IS NOT NULL AND identifier != ''"
    add_foreign_key :contacts, :accounts, column: :account_id

    # Contact Inboxes (join table)
    create_table :contact_inboxes, id: :uuid do |t|
      t.uuid :contact_id, null: false
      t.uuid :inbox_id, null: false
      t.string :source_id, null: false

      t.timestamps
    end

    add_index :contact_inboxes, :contact_id
    add_index :contact_inboxes, :inbox_id
    add_index :contact_inboxes, [:source_id, :inbox_id], unique: true
    add_foreign_key :contact_inboxes, :contacts, column: :contact_id
    add_foreign_key :contact_inboxes, :inboxes, column: :inbox_id

    # Conversations table
    create_table :conversations, id: :uuid do |t|
      t.uuid :uuid, null: false, default: -> { 'gen_random_uuid()' }
      t.integer :status, default: 0, null: false
      t.integer :priority, default: 0
      t.jsonb :additional_attributes, default: {}
      t.jsonb :custom_attributes, default: {}
      t.datetime :last_activity_at, null: false
      t.datetime :contact_last_seen_at
      t.datetime :agent_last_seen_at
      t.datetime :first_reply_created_at
      t.datetime :waiting_since
      t.datetime :snoozed_until
      t.uuid :account_id, null: false
      t.uuid :inbox_id, null: false
      t.uuid :contact_id, null: false
      t.uuid :contact_inbox_id, null: false
      t.uuid :assignee_id
      t.uuid :team_id
      t.uuid :campaign_id
      t.uuid :assignee_agent_bot_id

      t.timestamps
    end

    add_index :conversations, :account_id
    add_index :conversations, :inbox_id
    add_index :conversations, :contact_id
    add_index :conversations, :contact_inbox_id
    add_index :conversations, :uuid, unique: true
    add_index :conversations, :status
    add_index :conversations, :campaign_id
    add_foreign_key :conversations, :accounts, column: :account_id
    add_foreign_key :conversations, :inboxes, column: :inbox_id
    add_foreign_key :conversations, :contacts, column: :contact_id
    add_foreign_key :conversations, :contact_inboxes, column: :contact_inbox_id

    # Messages table
    create_table :messages, id: :uuid do |t|
      t.text :content
      t.integer :message_type, null: false
      t.integer :content_type, default: 0, null: false
      t.integer :status, default: 0
      t.boolean :private, default: false
      t.string :sender_type
      t.uuid :sender_id
      t.string :source_id
      t.jsonb :content_attributes, default: {}
      t.jsonb :additional_attributes, default: {}
      t.text :processed_message_content
      t.uuid :account_id, null: false
      t.uuid :inbox_id, null: false
      t.uuid :conversation_id, null: false

      t.timestamps
    end

    add_index :messages, :account_id
    add_index :messages, :inbox_id
    add_index :messages, :conversation_id
    add_index :messages, [:sender_type, :sender_id]
    add_index :messages, :source_id
    add_index :messages, :created_at
    add_foreign_key :messages, :accounts, column: :account_id
    add_foreign_key :messages, :inboxes, column: :inbox_id
    add_foreign_key :messages, :conversations, column: :conversation_id

    # Labels table
    create_table :labels, id: :uuid do |t|
      t.string :title, null: false
      t.string :description
      t.string :color, null: false
      t.boolean :show_on_sidebar, default: true
      t.uuid :account_id, null: false

      t.timestamps
    end

    add_index :labels, :account_id
    add_index :labels, [:title, :account_id], unique: true
    add_foreign_key :labels, :accounts, column: :account_id

    # Conversation Labels (join table)
    create_table :conversation_labels, id: :uuid do |t|
      t.uuid :conversation_id, null: false
      t.uuid :label_id, null: false

      t.timestamps
    end

    add_index :conversation_labels, :conversation_id
    add_index :conversation_labels, :label_id
    add_index :conversation_labels, [:conversation_id, :label_id], unique: true
    add_foreign_key :conversation_labels, :conversations, column: :conversation_id
    add_foreign_key :conversation_labels, :labels, column: :label_id

    # Campaigns table
    create_table :campaigns, id: :uuid do |t|
      t.string :title, null: false
      t.text :message
      t.integer :campaign_type, default: 0
      t.integer :campaign_status, default: 0
      t.uuid :account_id, null: false
      t.uuid :inbox_id, null: false
      t.uuid :sender_id
      t.boolean :enabled, default: true
      t.jsonb :audience, default: []
      t.datetime :scheduled_at
      t.datetime :triggered_at

      t.timestamps
    end

    add_index :campaigns, :account_id
    add_index :campaigns, :inbox_id
    add_index :campaigns, :campaign_status
    add_foreign_key :campaigns, :accounts, column: :account_id
    add_foreign_key :campaigns, :inboxes, column: :inbox_id

    # Automation Rules table
    create_table :automation_rules, id: :uuid do |t|
      t.string :name, null: false
      t.text :description
      t.integer :event_name, null: false
      t.jsonb :conditions, default: []
      t.jsonb :actions, default: []
      t.boolean :active, default: true
      t.uuid :account_id, null: false

      t.timestamps
    end

    add_index :automation_rules, :account_id
    add_index :automation_rules, :event_name
    add_index :automation_rules, :active
    add_foreign_key :automation_rules, :accounts, column: :account_id

    # Agent Bots table
    create_table :agent_bots, id: :uuid do |t|
      t.string :name, null: false
      t.text :description
      t.integer :bot_type, default: 0
      t.jsonb :bot_config, default: {}
      t.uuid :account_id, null: false

      t.timestamps
    end

    add_index :agent_bots, :account_id
    add_foreign_key :agent_bots, :accounts, column: :account_id

    # Agent Bot Inboxes (join table)
    create_table :agent_bot_inboxes, id: :uuid do |t|
      t.uuid :inbox_id, null: false
      t.uuid :agent_bot_id, null: false
      t.integer :status, default: 0

      t.timestamps
    end

    add_index :agent_bot_inboxes, :inbox_id, unique: true
    add_index :agent_bot_inboxes, :agent_bot_id
    add_foreign_key :agent_bot_inboxes, :inboxes, column: :inbox_id
    add_foreign_key :agent_bot_inboxes, :agent_bots, column: :agent_bot_id

    # Webhooks table
    create_table :webhooks, id: :uuid do |t|
      t.string :url, null: false
      t.uuid :account_id, null: false
      t.uuid :inbox_id
      t.jsonb :subscriptions, default: []

      t.timestamps
    end

    add_index :webhooks, :account_id
    add_index :webhooks, :inbox_id
    add_foreign_key :webhooks, :accounts, column: :account_id
    add_foreign_key :webhooks, :inboxes, column: :inbox_id

    # Reset search path
    execute "SET search_path TO public"
  end

  def down
    # Drop all tables in messaging schema
    execute "DROP SCHEMA IF EXISTS messaging CASCADE"
  end
end

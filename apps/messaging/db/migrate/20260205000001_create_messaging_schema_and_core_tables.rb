class CreateMessagingSchemaAndCoreTables < ActiveRecord::Migration[7.2]
  def up
    # Enable UUID extension (needed for conversation.uuid secondary column)
    enable_extension 'pgcrypto' unless extension_enabled?('pgcrypto')

    # Accounts table
    create_table :accounts do |t|
      t.string :name, null: false
      t.string :locale, default: 'en'
      t.integer :status, default: 0, null: false
      t.jsonb :settings, default: {}
      t.jsonb :limits, default: {}
      t.integer :ventia_tenant_id, null: false

      t.timestamps
    end

    add_index :accounts, :status
    add_index :accounts, :ventia_tenant_id, unique: true

    # Channel WhatsApp table
    create_table :channel_whatsapp do |t|
      t.string :phone_number, null: false
      t.string :provider, default: 'whatsapp_cloud'
      t.jsonb :provider_config, default: {}
      t.jsonb :message_templates, default: []
      t.datetime :message_templates_last_updated
      t.bigint :account_id, null: false

      t.timestamps
    end

    add_index :channel_whatsapp, :phone_number, unique: true
    add_index :channel_whatsapp, :account_id
    add_foreign_key :channel_whatsapp, :accounts, column: :account_id

    # Inboxes table
    create_table :inboxes do |t|
      t.string :name, null: false
      t.string :channel_type, null: false
      t.bigint :channel_id, null: false
      t.bigint :account_id, null: false
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
    create_table :contacts do |t|
      t.string :name, default: ''
      t.string :email
      t.string :phone_number
      t.string :identifier
      t.jsonb :additional_attributes, default: {}
      t.jsonb :custom_attributes, default: {}
      t.integer :contact_type, default: 0
      t.boolean :blocked, default: false
      t.datetime :last_activity_at
      t.bigint :account_id, null: false

      t.timestamps
    end

    add_index :contacts, :account_id
    add_index :contacts, [:email, :account_id], unique: true, where: "email IS NOT NULL AND email != ''"
    add_index :contacts, [:phone_number, :account_id], unique: true, where: "phone_number IS NOT NULL AND phone_number != ''"
    add_index :contacts, [:identifier, :account_id], unique: true, where: "identifier IS NOT NULL AND identifier != ''"
    add_foreign_key :contacts, :accounts, column: :account_id

    # Contact Inboxes (join table)
    create_table :contact_inboxes do |t|
      t.bigint :contact_id, null: false
      t.bigint :inbox_id, null: false
      t.string :source_id, null: false

      t.timestamps
    end

    add_index :contact_inboxes, :contact_id
    add_index :contact_inboxes, :inbox_id
    add_index :contact_inboxes, [:source_id, :inbox_id], unique: true
    add_foreign_key :contact_inboxes, :contacts, column: :contact_id
    add_foreign_key :contact_inboxes, :inboxes, column: :inbox_id

    # Conversations table
    create_table :conversations do |t|
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
      t.bigint :account_id, null: false
      t.bigint :inbox_id, null: false
      t.bigint :contact_id, null: false
      t.bigint :contact_inbox_id, null: false
      t.bigint :assignee_id
      t.bigint :team_id
      t.bigint :campaign_id
      t.bigint :assignee_agent_bot_id

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
    create_table :messages do |t|
      t.text :content
      t.integer :message_type, null: false
      t.integer :content_type, default: 0, null: false
      t.integer :status, default: 0
      t.boolean :private, default: false
      t.string :sender_type
      t.bigint :sender_id
      t.string :source_id
      t.jsonb :content_attributes, default: {}
      t.jsonb :additional_attributes, default: {}
      t.text :processed_message_content
      t.bigint :account_id, null: false
      t.bigint :inbox_id, null: false
      t.bigint :conversation_id, null: false

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
    create_table :labels do |t|
      t.string :title, null: false
      t.string :description
      t.string :color, null: false
      t.boolean :show_on_sidebar, default: true
      t.bigint :account_id, null: false

      t.timestamps
    end

    add_index :labels, :account_id
    add_index :labels, [:title, :account_id], unique: true
    add_foreign_key :labels, :accounts, column: :account_id

    # Conversation Labels (join table)
    create_table :conversation_labels do |t|
      t.bigint :conversation_id, null: false
      t.bigint :label_id, null: false

      t.timestamps
    end

    add_index :conversation_labels, :conversation_id
    add_index :conversation_labels, :label_id
    add_index :conversation_labels, [:conversation_id, :label_id], unique: true
    add_foreign_key :conversation_labels, :conversations, column: :conversation_id
    add_foreign_key :conversation_labels, :labels, column: :label_id

    # Campaigns table
    create_table :campaigns do |t|
      t.string :title, null: false
      t.text :message
      t.integer :campaign_type, default: 0
      t.integer :campaign_status, default: 0
      t.bigint :account_id, null: false
      t.bigint :inbox_id, null: false
      t.bigint :sender_id
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
    create_table :automation_rules do |t|
      t.string :name, null: false
      t.text :description
      t.integer :event_name, null: false
      t.jsonb :conditions, default: []
      t.jsonb :actions, default: []
      t.boolean :active, default: true
      t.bigint :account_id, null: false

      t.timestamps
    end

    add_index :automation_rules, :account_id
    add_index :automation_rules, :event_name
    add_index :automation_rules, :active
    add_foreign_key :automation_rules, :accounts, column: :account_id

    # Agent Bots table
    create_table :agent_bots do |t|
      t.string :name, null: false
      t.text :description
      t.integer :bot_type, default: 0
      t.jsonb :bot_config, default: {}
      t.bigint :account_id, null: false

      t.timestamps
    end

    add_index :agent_bots, :account_id
    add_foreign_key :agent_bots, :accounts, column: :account_id

    # Agent Bot Inboxes (join table)
    create_table :agent_bot_inboxes do |t|
      t.bigint :inbox_id, null: false
      t.bigint :agent_bot_id, null: false
      t.integer :status, default: 0

      t.timestamps
    end

    add_index :agent_bot_inboxes, :inbox_id, unique: true
    add_index :agent_bot_inboxes, :agent_bot_id
    add_foreign_key :agent_bot_inboxes, :inboxes, column: :inbox_id
    add_foreign_key :agent_bot_inboxes, :agent_bots, column: :agent_bot_id

    # Webhooks table
    create_table :webhooks do |t|
      t.string :url, null: false
      t.bigint :account_id, null: false
      t.bigint :inbox_id
      t.jsonb :subscriptions, default: []

      t.timestamps
    end

    add_index :webhooks, :account_id
    add_index :webhooks, :inbox_id
    add_foreign_key :webhooks, :accounts, column: :account_id
    add_foreign_key :webhooks, :inboxes, column: :inbox_id

  end

  def down
    drop_table :webhooks, if_exists: true
    drop_table :agent_bot_inboxes, if_exists: true
    drop_table :agent_bots, if_exists: true
    drop_table :automation_rules, if_exists: true
    drop_table :campaigns, if_exists: true
    drop_table :conversation_labels, if_exists: true
    drop_table :labels, if_exists: true
    drop_table :messages, if_exists: true
    drop_table :conversations, if_exists: true
    drop_table :contact_inboxes, if_exists: true
    drop_table :contacts, if_exists: true
    drop_table :inboxes, if_exists: true
    drop_table :channel_whatsapp, if_exists: true
    drop_table :accounts, if_exists: true
  end
end

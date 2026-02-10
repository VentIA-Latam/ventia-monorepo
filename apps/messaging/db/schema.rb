# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# This file is the source Rails uses to define your schema when running `bin/rails
# db:schema:load`. When creating a new database, `bin/rails db:schema:load` tends to
# be faster and is potentially less error prone than running all of your
# migrations from scratch. Old migrations may fail to apply correctly if those
# migrations use external dependencies or application code.
#
# It's strongly recommended that you check this file into your version control system.

ActiveRecord::Schema[7.2].define(version: 2026_02_05_000002) do
  create_schema "messaging"

  # These are extensions that must be enabled in order to support this database
  enable_extension "pgcrypto"
  enable_extension "plpgsql"

  create_table "accounts", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.string "name", null: false
    t.string "locale", default: "en"
    t.integer "status", default: 0, null: false
    t.jsonb "settings", default: {}
    t.jsonb "limits", default: {}
    t.uuid "ventia_tenant_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["status"], name: "index_accounts_on_status"
    t.index ["ventia_tenant_id"], name: "index_accounts_on_ventia_tenant_id", unique: true
  end

  create_table "agent_bot_inboxes", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.uuid "inbox_id", null: false
    t.uuid "agent_bot_id", null: false
    t.integer "status", default: 0
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["agent_bot_id"], name: "index_agent_bot_inboxes_on_agent_bot_id"
    t.index ["inbox_id"], name: "index_agent_bot_inboxes_on_inbox_id", unique: true
  end

  create_table "agent_bots", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.string "name", null: false
    t.text "description"
    t.integer "bot_type", default: 0
    t.jsonb "bot_config", default: {}
    t.uuid "account_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["account_id"], name: "index_agent_bots_on_account_id"
  end

  create_table "automation_rules", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.string "name", null: false
    t.text "description"
    t.integer "event_name", null: false
    t.jsonb "conditions", default: []
    t.jsonb "actions", default: []
    t.boolean "active", default: true
    t.uuid "account_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["account_id"], name: "index_automation_rules_on_account_id"
    t.index ["active"], name: "index_automation_rules_on_active"
    t.index ["event_name"], name: "index_automation_rules_on_event_name"
  end

  create_table "campaigns", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.string "title", null: false
    t.text "message"
    t.integer "campaign_type", default: 0
    t.integer "campaign_status", default: 0
    t.uuid "account_id", null: false
    t.uuid "inbox_id", null: false
    t.uuid "sender_id"
    t.boolean "enabled", default: true
    t.jsonb "audience", default: []
    t.datetime "scheduled_at"
    t.datetime "triggered_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["account_id"], name: "index_campaigns_on_account_id"
    t.index ["campaign_status"], name: "index_campaigns_on_campaign_status"
    t.index ["inbox_id"], name: "index_campaigns_on_inbox_id"
  end

  create_table "channel_whatsapp", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.string "phone_number", null: false
    t.string "provider", default: "whatsapp_cloud"
    t.jsonb "provider_config", default: {}
    t.jsonb "message_templates", default: []
    t.datetime "message_templates_last_updated"
    t.uuid "account_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["account_id"], name: "index_channel_whatsapp_on_account_id"
    t.index ["phone_number"], name: "index_channel_whatsapp_on_phone_number", unique: true
  end

  create_table "contact_inboxes", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.uuid "contact_id", null: false
    t.uuid "inbox_id", null: false
    t.string "source_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["contact_id"], name: "index_contact_inboxes_on_contact_id"
    t.index ["inbox_id"], name: "index_contact_inboxes_on_inbox_id"
    t.index ["source_id", "inbox_id"], name: "index_contact_inboxes_on_source_id_and_inbox_id", unique: true
  end

  create_table "contacts", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.string "name", default: ""
    t.string "email"
    t.string "phone_number"
    t.string "identifier"
    t.jsonb "additional_attributes", default: {}
    t.jsonb "custom_attributes", default: {}
    t.integer "contact_type", default: 0
    t.boolean "blocked", default: false
    t.datetime "last_activity_at"
    t.uuid "account_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["account_id"], name: "index_contacts_on_account_id"
    t.index ["email", "account_id"], name: "index_contacts_on_email_and_account_id", unique: true, where: "((email IS NOT NULL) AND ((email)::text <> ''::text))"
    t.index ["identifier", "account_id"], name: "index_contacts_on_identifier_and_account_id", unique: true, where: "((identifier IS NOT NULL) AND ((identifier)::text <> ''::text))"
    t.index ["phone_number", "account_id"], name: "index_contacts_on_phone_number_and_account_id", unique: true, where: "((phone_number IS NOT NULL) AND ((phone_number)::text <> ''::text))"
  end

  create_table "conversation_labels", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.uuid "conversation_id", null: false
    t.uuid "label_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["conversation_id", "label_id"], name: "index_conversation_labels_on_conversation_id_and_label_id", unique: true
    t.index ["conversation_id"], name: "index_conversation_labels_on_conversation_id"
    t.index ["label_id"], name: "index_conversation_labels_on_label_id"
  end

  create_table "conversations", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.uuid "uuid", default: -> { "gen_random_uuid()" }, null: false
    t.integer "status", default: 0, null: false
    t.integer "priority", default: 0
    t.jsonb "additional_attributes", default: {}
    t.jsonb "custom_attributes", default: {}
    t.datetime "last_activity_at", null: false
    t.datetime "contact_last_seen_at"
    t.datetime "agent_last_seen_at"
    t.datetime "first_reply_created_at"
    t.datetime "waiting_since"
    t.datetime "snoozed_until"
    t.uuid "account_id", null: false
    t.uuid "inbox_id", null: false
    t.uuid "contact_id", null: false
    t.uuid "contact_inbox_id", null: false
    t.uuid "assignee_id"
    t.uuid "team_id"
    t.uuid "campaign_id"
    t.uuid "assignee_agent_bot_id"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["account_id"], name: "index_conversations_on_account_id"
    t.index ["campaign_id"], name: "index_conversations_on_campaign_id"
    t.index ["contact_id"], name: "index_conversations_on_contact_id"
    t.index ["contact_inbox_id"], name: "index_conversations_on_contact_inbox_id"
    t.index ["inbox_id"], name: "index_conversations_on_inbox_id"
    t.index ["status"], name: "index_conversations_on_status"
    t.index ["uuid"], name: "index_conversations_on_uuid", unique: true
  end

  create_table "inboxes", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.string "name", null: false
    t.string "channel_type", null: false
    t.uuid "channel_id", null: false
    t.uuid "account_id", null: false
    t.boolean "greeting_enabled", default: false
    t.string "greeting_message"
    t.boolean "enable_auto_assignment", default: true
    t.jsonb "auto_assignment_config", default: {}
    t.boolean "allow_messages_after_resolved", default: true
    t.boolean "lock_to_single_conversation", default: false
    t.boolean "working_hours_enabled", default: false
    t.string "out_of_office_message"
    t.string "timezone", default: "UTC"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["account_id"], name: "index_inboxes_on_account_id"
    t.index ["channel_id", "channel_type"], name: "index_inboxes_on_channel_id_and_channel_type"
  end

  create_table "labels", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.string "title", null: false
    t.string "description"
    t.string "color", null: false
    t.boolean "show_on_sidebar", default: true
    t.uuid "account_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["account_id"], name: "index_labels_on_account_id"
    t.index ["title", "account_id"], name: "index_labels_on_title_and_account_id", unique: true
  end

  create_table "macros", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.uuid "account_id", null: false
    t.string "name", null: false
    t.integer "visibility", default: 0, null: false
    t.uuid "created_by_id"
    t.uuid "updated_by_id"
    t.jsonb "actions", default: [], null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["account_id"], name: "index_macros_on_account_id"
    t.index ["created_by_id"], name: "index_macros_on_created_by_id"
    t.index ["visibility"], name: "index_macros_on_visibility"
  end

  create_table "messages", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.text "content"
    t.integer "message_type", null: false
    t.integer "content_type", default: 0, null: false
    t.integer "status", default: 0
    t.boolean "private", default: false
    t.string "sender_type"
    t.uuid "sender_id"
    t.string "source_id"
    t.jsonb "content_attributes", default: {}
    t.jsonb "additional_attributes", default: {}
    t.text "processed_message_content"
    t.uuid "account_id", null: false
    t.uuid "inbox_id", null: false
    t.uuid "conversation_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["account_id"], name: "index_messages_on_account_id"
    t.index ["conversation_id"], name: "index_messages_on_conversation_id"
    t.index ["created_at"], name: "index_messages_on_created_at"
    t.index ["inbox_id"], name: "index_messages_on_inbox_id"
    t.index ["sender_type", "sender_id"], name: "index_messages_on_sender_type_and_sender_id"
    t.index ["source_id"], name: "index_messages_on_source_id"
  end

  create_table "webhooks", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.string "url", null: false
    t.uuid "account_id", null: false
    t.uuid "inbox_id"
    t.jsonb "subscriptions", default: []
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["account_id"], name: "index_webhooks_on_account_id"
    t.index ["inbox_id"], name: "index_webhooks_on_inbox_id"
  end

  add_foreign_key "agent_bot_inboxes", "agent_bots"
  add_foreign_key "agent_bot_inboxes", "inboxes"
  add_foreign_key "agent_bots", "accounts"
  add_foreign_key "automation_rules", "accounts"
  add_foreign_key "campaigns", "accounts"
  add_foreign_key "campaigns", "inboxes"
  add_foreign_key "channel_whatsapp", "accounts"
  add_foreign_key "contact_inboxes", "contacts"
  add_foreign_key "contact_inboxes", "inboxes"
  add_foreign_key "contacts", "accounts"
  add_foreign_key "conversation_labels", "conversations"
  add_foreign_key "conversation_labels", "labels"
  add_foreign_key "conversations", "accounts"
  add_foreign_key "conversations", "contact_inboxes"
  add_foreign_key "conversations", "contacts"
  add_foreign_key "conversations", "inboxes"
  add_foreign_key "inboxes", "accounts"
  add_foreign_key "labels", "accounts"
  add_foreign_key "macros", "accounts"
  add_foreign_key "messages", "accounts"
  add_foreign_key "messages", "conversations"
  add_foreign_key "messages", "inboxes"
  add_foreign_key "webhooks", "accounts"
  add_foreign_key "webhooks", "inboxes"
end

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

ActiveRecord::Schema[7.2].define(version: 2026_03_24_200001) do
  create_schema "messaging"

  # These are extensions that must be enabled in order to support this database
  enable_extension "pgcrypto"
  enable_extension "plpgsql"

  create_table "account_users", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.uuid "account_id", null: false
    t.uuid "user_id", null: false
    t.integer "role", default: 0, null: false
    t.integer "availability", default: 0, null: false
    t.boolean "auto_offline", default: true, null: false
    t.datetime "active_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["account_id", "user_id"], name: "index_account_users_on_account_id_and_user_id", unique: true
  end

  create_table "accounts", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.string "name", null: false
    t.string "locale", default: "en"
    t.integer "status", default: 0, null: false
    t.jsonb "settings", default: {}
    t.jsonb "limits", default: {}
    t.string "ventia_tenant_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.boolean "notify_ai_messages", default: false, null: false
    t.index ["status"], name: "index_accounts_on_status"
    t.index ["ventia_tenant_id"], name: "index_accounts_on_ventia_tenant_id", unique: true
  end

  create_table "active_storage_attachments", force: :cascade do |t|
    t.string "name", null: false
    t.string "record_type", null: false
    t.bigint "record_id", null: false
    t.bigint "blob_id", null: false
    t.datetime "created_at", null: false
    t.index ["blob_id"], name: "index_active_storage_attachments_on_blob_id"
    t.index ["record_type", "record_id", "name", "blob_id"], name: "index_active_storage_attachments_uniqueness", unique: true
  end

  create_table "active_storage_blobs", force: :cascade do |t|
    t.string "key", null: false
    t.string "filename", null: false
    t.string "content_type"
    t.text "metadata"
    t.string "service_name", null: false
    t.bigint "byte_size", null: false
    t.string "checksum"
    t.datetime "created_at", null: false
    t.index ["key"], name: "index_active_storage_blobs_on_key", unique: true
  end

  create_table "active_storage_variant_records", force: :cascade do |t|
    t.bigint "blob_id", null: false
    t.string "variation_digest", null: false
    t.index ["blob_id", "variation_digest"], name: "index_active_storage_variant_records_uniqueness", unique: true
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

  create_table "attachments", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.uuid "account_id", null: false
    t.uuid "message_id", null: false
    t.integer "file_type", default: 0
    t.string "external_url"
    t.string "extension"
    t.float "coordinates_lat", default: 0.0
    t.float "coordinates_long", default: 0.0
    t.jsonb "meta", default: {}
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["account_id"], name: "index_attachments_on_account_id"
    t.index ["message_id"], name: "index_attachments_on_message_id"
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

  create_table "canned_responses", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.uuid "account_id", null: false
    t.string "short_code", null: false
    t.text "content", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["account_id", "short_code"], name: "index_canned_responses_on_account_id_and_short_code", unique: true
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

  create_table "conversation_participants", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.uuid "account_id", null: false
    t.uuid "conversation_id", null: false
    t.uuid "user_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["conversation_id", "user_id"], name: "index_conversation_participants_on_conversation_id_and_user_id", unique: true
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
    t.boolean "ai_agent_enabled", default: true, null: false
    t.integer "temperature"
    t.integer "stage", default: 0, null: false
    t.index ["account_id"], name: "index_conversations_on_account_id"
    t.index ["assignee_id"], name: "index_conversations_on_assignee_id"
    t.index ["campaign_id"], name: "index_conversations_on_campaign_id"
    t.index ["contact_id"], name: "index_conversations_on_contact_id"
    t.index ["contact_inbox_id"], name: "index_conversations_on_contact_inbox_id"
    t.index ["first_reply_created_at"], name: "index_conversations_on_first_reply_created_at"
    t.index ["inbox_id"], name: "index_conversations_on_inbox_id"
    t.index ["stage"], name: "index_conversations_on_stage"
    t.index ["status"], name: "index_conversations_on_status"
    t.index ["team_id"], name: "index_conversations_on_team_id"
    t.index ["temperature"], name: "index_conversations_on_temperature"
    t.index ["uuid"], name: "index_conversations_on_uuid", unique: true
    t.index ["waiting_since"], name: "index_conversations_on_waiting_since"
  end

  create_table "inbox_members", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.uuid "inbox_id", null: false
    t.uuid "user_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["inbox_id", "user_id"], name: "index_inbox_members_on_inbox_id_and_user_id", unique: true
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
    t.boolean "system", default: false, null: false
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

  create_table "notification_settings", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.uuid "account_id", null: false
    t.uuid "user_id", null: false
    t.integer "email_flags", default: 0, null: false
    t.integer "push_flags", default: 7, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["account_id", "user_id"], name: "index_notification_settings_on_account_id_and_user_id", unique: true
  end

  create_table "notifications", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.uuid "account_id", null: false
    t.uuid "user_id", null: false
    t.integer "notification_type", null: false
    t.string "primary_actor_type", null: false
    t.uuid "primary_actor_id", null: false
    t.string "secondary_actor_type"
    t.uuid "secondary_actor_id"
    t.datetime "read_at"
    t.datetime "snoozed_until"
    t.datetime "last_activity_at"
    t.jsonb "meta", default: {}
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["primary_actor_type", "primary_actor_id"], name: "index_notifications_on_primary_actor_type_and_primary_actor_id"
    t.index ["user_id", "account_id", "read_at"], name: "index_notifications_on_user_id_and_account_id_and_read_at"
  end

  create_table "push_subscription_tokens", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.uuid "user_id", null: false
    t.uuid "account_id", null: false
    t.text "token", null: false
    t.integer "platform", default: 0, null: false
    t.jsonb "device_info", default: {}
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["account_id"], name: "index_push_subscription_tokens_on_account_id"
    t.index ["user_id", "token"], name: "index_push_subscription_tokens_on_user_id_and_token", unique: true
    t.index ["user_id"], name: "index_push_subscription_tokens_on_user_id"
  end

  create_table "team_members", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.uuid "team_id", null: false
    t.uuid "user_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["team_id", "user_id"], name: "index_team_members_on_team_id_and_user_id", unique: true
  end

  create_table "teams", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.uuid "account_id", null: false
    t.string "name", null: false
    t.text "description"
    t.boolean "allow_auto_assign", default: true
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["account_id", "name"], name: "index_teams_on_account_id_and_name", unique: true
  end

  create_table "users", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.uuid "ventia_user_id", null: false
    t.string "name", null: false
    t.string "email", null: false
    t.string "avatar_url"
    t.string "pubsub_token"
    t.jsonb "custom_attributes", default: {}
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["email"], name: "index_users_on_email"
    t.index ["pubsub_token"], name: "index_users_on_pubsub_token", unique: true
    t.index ["ventia_user_id"], name: "index_users_on_ventia_user_id", unique: true
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

  add_foreign_key "account_users", "accounts"
  add_foreign_key "account_users", "users"
  add_foreign_key "active_storage_attachments", "active_storage_blobs", column: "blob_id"
  add_foreign_key "active_storage_variant_records", "active_storage_blobs", column: "blob_id"
  add_foreign_key "agent_bot_inboxes", "agent_bots"
  add_foreign_key "agent_bot_inboxes", "inboxes"
  add_foreign_key "agent_bots", "accounts"
  add_foreign_key "attachments", "accounts"
  add_foreign_key "attachments", "messages"
  add_foreign_key "automation_rules", "accounts"
  add_foreign_key "campaigns", "accounts"
  add_foreign_key "campaigns", "inboxes"
  add_foreign_key "canned_responses", "accounts"
  add_foreign_key "channel_whatsapp", "accounts"
  add_foreign_key "contact_inboxes", "contacts"
  add_foreign_key "contact_inboxes", "inboxes"
  add_foreign_key "contacts", "accounts"
  add_foreign_key "conversation_labels", "conversations"
  add_foreign_key "conversation_labels", "labels"
  add_foreign_key "conversation_participants", "accounts"
  add_foreign_key "conversation_participants", "conversations"
  add_foreign_key "conversation_participants", "users"
  add_foreign_key "conversations", "accounts"
  add_foreign_key "conversations", "contact_inboxes"
  add_foreign_key "conversations", "contacts"
  add_foreign_key "conversations", "inboxes"
  add_foreign_key "conversations", "teams"
  add_foreign_key "conversations", "users", column: "assignee_id"
  add_foreign_key "inbox_members", "inboxes"
  add_foreign_key "inbox_members", "users"
  add_foreign_key "inboxes", "accounts"
  add_foreign_key "labels", "accounts"
  add_foreign_key "macros", "accounts"
  add_foreign_key "messages", "accounts"
  add_foreign_key "messages", "conversations"
  add_foreign_key "messages", "inboxes"
  add_foreign_key "notification_settings", "accounts"
  add_foreign_key "notification_settings", "users"
  add_foreign_key "notifications", "accounts"
  add_foreign_key "notifications", "users"
  add_foreign_key "push_subscription_tokens", "accounts"
  add_foreign_key "push_subscription_tokens", "users"
  add_foreign_key "team_members", "teams"
  add_foreign_key "team_members", "users"
  add_foreign_key "teams", "accounts"
  add_foreign_key "webhooks", "accounts"
  add_foreign_key "webhooks", "inboxes"
end

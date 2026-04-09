# Event System Verification Guide

This guide helps you verify that the Wisper event system is working correctly with automation rules, webhooks, and campaigns.

## Prerequisites

1. Start the messaging service:
```bash
cd C:\Users\Renzo\Desktop\Proyectos\Ventia\ventia-monorepo
docker-compose -f docker-compose.dev.yml up messaging messaging-sidekiq redis
```

2. Access Rails console:
```bash
docker exec -it ventia-messaging bundle exec rails console
```

## Test 1: Verify Listeners are Registered

```ruby
# Check that Wisper has registered listeners
Wisper.subscribers
# Should show: AutomationRuleListener, WebhookListener, CampaignListener
```

## Test 2: Automation Rule Event (conversation_created)

```ruby
# Create test data
account = Account.first || Account.create!(
  name: "Test Account",
  ventia_tenant_id: SecureRandom.uuid
)

inbox = account.inboxes.first || Inbox.create!(
  account: account,
  name: "Test Inbox",
  channel_type: :api
)

contact = account.contacts.first || Contact.create!(
  account: account,
  name: "Test Contact",
  phone_number: "+51999999999"
)

contact_inbox = ContactInbox.find_or_create_by!(
  contact: contact,
  inbox: inbox,
  source_id: contact.phone_number
)

# Create an automation rule
rule = AutomationRule.create!(
  account: account,
  name: "Welcome Message",
  event_name: :conversation_created,
  active: true,
  conditions: [
    { attribute_key: "status", filter_operator: "equal_to", values: ["open"] }
  ],
  actions: [
    { action_name: "send_message", action_params: { message: "Hello! How can I help you?" } }
  ]
)

# Trigger event by creating a conversation
conversation = Conversation.create!(
  account: account,
  inbox: inbox,
  contact: contact,
  contact_inbox: contact_inbox,
  status: :open
)

# VERIFY: Check that the automation rule executed
# 1. Check logs for "[Event] Conversation ... created"
# 2. Check that a message was created automatically
conversation.messages.last
# Should show: content="Hello! How can I help you?"
```

Expected output in logs:
```
[Event] Conversation <uuid> created
[Automation] Executing rule: Welcome Message
[Event] Message <uuid> created for conversation <uuid>
```

## Test 3: Webhook Event

```ruby
# Create a webhook (use webhook.site for testing)
webhook = Webhook.create!(
  account: account,
  url: "https://webhook.site/YOUR-UNIQUE-URL", # Replace with real URL
  subscriptions: ["conversation_created", "message_created"]
)

# Create a new conversation to trigger webhook
conversation = Conversation.create!(
  account: account,
  inbox: inbox,
  contact: contact,
  contact_inbox: contact_inbox,
  status: :open
)

# VERIFY:
# 1. Check webhook.site - should receive POST with conversation data
# 2. Check Sidekiq queue
require 'sidekiq/api'
stats = Sidekiq::Stats.new
puts "Enqueued jobs: #{stats.enqueued}"
puts "Processed jobs: #{stats.processed}"
```

Expected webhook payload:
```json
{
  "event": "conversation_created",
  "data": {
    "id": "...",
    "uuid": "...",
    "status": "open",
    "account_id": "...",
    "inbox_id": "...",
    "contact_id": "..."
  }
}
```

## Test 4: Message Created Event with Automation

```ruby
# Create a message-based automation rule
message_rule = AutomationRule.create!(
  account: account,
  name: "Auto Reply to Incoming",
  event_name: :message_created,
  active: true,
  conditions: [
    { attribute_key: "status", filter_operator: "equal_to", values: ["open"] }
  ],
  actions: [
    { action_name: "send_message", action_params: { message: "Thanks for your message!" } }
  ]
)

# Create an incoming message
message = Message.create!(
  account: account,
  inbox: inbox,
  conversation: conversation,
  message_type: :incoming,
  content_type: :text,
  content: "Hello there!"
)

# VERIFY: Check that auto-reply was sent
conversation.messages.count # Should be 2 (original + auto-reply)
conversation.messages.last.content # Should be "Thanks for your message!"
```

## Test 5: Campaign Events

```ruby
# Create a campaign
campaign = Campaign.create!(
  account: account,
  inbox: inbox,
  title: "Test Campaign",
  message: "Special promotion!",
  campaign_type: :one_off,
  campaign_status: :active,
  audience: []
)

# Trigger campaign
campaign.trigger!

# VERIFY: Check logs
# Should show:
# [Event] Campaign <uuid> status changed to ...
# [Campaign] Triggered: <uuid> - Test Campaign
```

Expected logs:
```
[Event] Campaign <uuid> triggered
[Campaign] Triggered: <uuid> - Test Campaign
```

## Test 6: Status Change Events

```ruby
# Change conversation status
conversation.resolve!

# VERIFY:
# 1. Check logs for status change event
# 2. Automation rules for "conversation_resolved" should execute
```

Expected logs:
```
[Event] Conversation <uuid> updated
[Event] Conversation <uuid> status changed to resolved
```

## Test 7: Multiple Events in Sequence

```ruby
# Test complete flow
conversation = Conversation.create!(
  account: account,
  inbox: inbox,
  contact: contact,
  contact_inbox: contact_inbox
)
# Event: conversation_created -> AutomationRule executes -> Message created

Message.create!(
  account: account,
  inbox: inbox,
  conversation: conversation,
  message_type: :incoming,
  content: "Help me"
)
# Event: message_created -> AutomationRule executes -> Auto-reply sent

conversation.resolve!
# Event: conversation_status_changed, conversation_updated

# VERIFY: Check all events fired in sequence
```

## Debugging Tips

### Check Sidekiq Queue Status

```ruby
require 'sidekiq/api'

# Stats
stats = Sidekiq::Stats.new
puts "Enqueued: #{stats.enqueued}"
puts "Processed: #{stats.processed}"
puts "Failed: #{stats.failed}"

# Queue details
Sidekiq::Queue.all.each do |queue|
  puts "Queue: #{queue.name}, Size: #{queue.size}"
end

# Failed jobs
Sidekiq::RetrySet.new.each do |job|
  puts "Failed: #{job.klass} - #{job.error_message}"
end
```

### Check Logs

```bash
# Messaging service logs
docker logs ventia-messaging -f | grep "Event\|Automation\|Webhook\|Campaign"

# Sidekiq logs
docker logs ventia-messaging-sidekiq -f
```

### Manual Event Broadcast (for debugging)

```ruby
# Manually broadcast an event
conversation = Conversation.first
conversation.broadcast(:conversation_updated, data: { conversation: conversation })

# This should trigger:
# - AutomationRuleListener
# - WebhookListener
```

## Expected Event Flow

```
1. User creates Conversation
   ↓
2. Conversation model broadcasts :conversation_created
   ↓
3. AutomationRuleListener receives event (async)
   ↓
4. Checks for active automation rules
   ↓
5. Executes matching rules (e.g., send_message)
   ↓
6. Message.create! is called
   ↓
7. Message model broadcasts :message_created
   ↓
8. WebhookListener receives events (async)
   ↓
9. Enqueues Webhooks::DeliverJob for each matching webhook
   ↓
10. Sidekiq processes jobs in background
```

## Troubleshooting

### Events not firing?
- Check that models include `Wisper::Publisher`
- Verify `after_create_commit` and `after_update_commit` callbacks exist
- Ensure listeners are registered in `config/initializers/wisper.rb`

### Automation rules not executing?
- Verify rule is `active: true`
- Check that `event_name` matches the broadcast event
- Ensure conditions are properly formatted
- Check logs for "[Automation]" entries

### Webhooks not being delivered?
- Verify Sidekiq is running: `docker ps | grep sidekiq`
- Check Redis connection: `docker logs ventia-messaging-sidekiq`
- Verify webhook URL is accessible
- Check Sidekiq failed jobs

### Listeners not registered?
- Restart the Rails server after initializer changes
- Check logs for "[Wisper] Event listeners registered successfully"
- Verify BaseListener uses `include Singleton`

## Success Criteria

✅ All events broadcast successfully
✅ AutomationRuleListener executes matching rules
✅ WebhookListener enqueues webhook delivery jobs
✅ CampaignListener logs campaign events
✅ Sidekiq processes background jobs
✅ No errors in Rails or Sidekiq logs
✅ Automation actions execute correctly (send_message, add_label, etc.)
✅ Webhooks receive POST requests with correct data

## Next Steps

After verification is complete:
1. Document any issues found and fixes applied
2. Add RSpec tests for event system (optional)
3. Start Ventia integration (Phase 9)

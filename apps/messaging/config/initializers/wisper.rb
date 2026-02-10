# Wisper configuration for event broadcasting
Wisper.configure do |config|
  # Use Wisper's default configuration
end

# Register global listeners
Rails.application.config.after_initialize do
  # Automation Rules - listeners dispatch to Sidekiq jobs internally
  Wisper.subscribe(AutomationRuleListener.instance)

  # Webhooks - listeners dispatch to Sidekiq jobs internally
  Wisper.subscribe(WebhookListener.instance)

  # Campaigns - execute synchronously for immediate logging
  Wisper.subscribe(CampaignListener.instance)

  Rails.logger.info "[Wisper] Event listeners registered successfully"
end

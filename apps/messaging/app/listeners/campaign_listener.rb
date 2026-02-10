class CampaignListener < BaseListener
  def campaign_status_changed(event)
    campaign = event.data[:campaign]

    Rails.logger.info "[Campaign] Status changed: #{campaign.id} -> #{campaign.campaign_status}"

    # Additional actions can be added here:
    # - Send notification to user
    # - Update statistics
    # - Dispatch webhooks specific to campaigns
  end

  def campaign_triggered(event)
    campaign = event.data[:campaign]

    Rails.logger.info "[Campaign] Triggered: #{campaign.id} - #{campaign.title}"

    # Track when campaign started
    # Can be used for analytics
  end

  def campaign_completed(event)
    campaign = event.data[:campaign]

    Rails.logger.info "[Campaign] Completed: #{campaign.id} - #{campaign.title}"

    # Update final statistics
    # Send completion notification
  end
end

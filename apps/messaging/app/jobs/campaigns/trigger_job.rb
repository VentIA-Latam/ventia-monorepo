class Campaigns::TriggerJob < ApplicationJob
  queue_as :campaigns

  def perform(campaign_id)
    campaign = Campaign.find_by(id: campaign_id)
    return unless campaign

    Campaigns::TriggerService.new(campaign: campaign).perform
  rescue StandardError => e
    Rails.logger.error "[Campaign] Job failed for campaign #{campaign_id}: #{e.message}"
    raise
  end
end

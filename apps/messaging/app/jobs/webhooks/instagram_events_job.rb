class Webhooks::InstagramEventsJob < ApplicationJob
  queue_as :low

  def perform(params = {})
    instagram_id = params.dig('entry', 0, 'id') || params.dig(:entry, 0, :id)
    channel = Channel::Instagram.find_by(instagram_id: instagram_id)

    if channel.blank?
      Rails.logger.warn("Instagram webhook: no channel found for instagram_id=#{instagram_id}")
      return
    end

    Instagram::IncomingMessageService.new(inbox: channel.inbox, params: params).perform
  end
end

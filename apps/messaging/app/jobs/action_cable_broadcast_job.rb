class ActionCableBroadcastJob < ApplicationJob
  queue_as :default

  def perform(tokens, event_name, data)
    return if tokens.blank?

    tokens.uniq.each do |token|
      ActionCable.server.broadcast(token, { event: event_name, data: data })
    end
  end
end

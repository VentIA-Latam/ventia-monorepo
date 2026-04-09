module AutoAssignment
  class AgentAssignmentService
    attr_reader :conversation, :allowed_agent_ids

    def initialize(conversation:, allowed_agent_ids:)
      @conversation = conversation
      @allowed_agent_ids = allowed_agent_ids
    end

    def find_assignee
      round_robin_service.available_agent(allowed_agent_ids: allowed_online_agent_ids)
    end

    def perform
      new_assignee = find_assignee
      conversation.update(assignee: new_assignee) if new_assignee
    end

    private

    def online_agent_ids
      available = OnlineStatusTracker.get_available_users(conversation.account_id)
      available.select { |_id, status| status == 'online' }.keys
    end

    def allowed_online_agent_ids
      online = online_agent_ids.map(&:to_s)
      allowed = allowed_agent_ids.map(&:to_s)
      online & allowed
    end

    def round_robin_service
      @round_robin_service ||= InboxRoundRobinService.new(inbox: conversation.inbox)
    end
  end
end

module AutoAssignment
  class InboxRoundRobinService
    attr_reader :inbox

    REDIS = $redis

    def initialize(inbox:)
      @inbox = inbox
    end

    def add_agent_to_queue(user_id)
      REDIS.lpush(round_robin_key, user_id)
    end

    def remove_agent_from_queue(user_id)
      REDIS.lrem(round_robin_key, 0, user_id)
    end

    def clear_queue
      REDIS.del(round_robin_key)
    end

    def reset_queue
      clear_queue
      inbox.inbox_members.pluck(:user_id).each do |user_id|
        add_agent_to_queue(user_id)
      end
    end

    def available_agent(allowed_agent_ids: [])
      reset_queue unless queue_valid?

      user_id = find_from_allowed(allowed_agent_ids)
      return if user_id.blank?

      User.find_by(id: user_id)
    end

    private

    def find_from_allowed(allowed_agent_ids)
      return nil if allowed_agent_ids.blank?

      allowed_set = allowed_agent_ids.map(&:to_s)
      match = queue.find { |id| allowed_set.include?(id.to_s) }

      if match
        # Move to end of queue (round-robin)
        remove_agent_from_queue(match)
        add_agent_to_queue(match)
      end

      match
    end

    def queue_valid?
      expected = inbox.inbox_members.pluck(:user_id).map(&:to_s).sort
      actual = queue.map(&:to_s).sort
      expected == actual
    end

    def queue
      REDIS.lrange(round_robin_key, 0, -1)
    end

    def round_robin_key
      "messaging:round_robin:inbox:#{inbox.id}"
    end
  end
end

class OnlineStatusTracker
  PRESENCE_DURATION = ENV.fetch('PRESENCE_DURATION', 20).to_i.seconds

  class << self
    # Update presence timestamp
    def update_presence(account_id, user_id)
      $redis.zadd(presence_key(account_id), Time.now.to_i, user_id)
    end

    # Check if user is currently present
    def get_presence(account_id, user_id)
      score = $redis.zscore(presence_key(account_id), user_id)
      score.present? && score > (Time.zone.now - PRESENCE_DURATION).to_i
    end

    # Set user status (online/offline/busy)
    def set_status(account_id, user_id, status)
      $redis.hset(status_key(account_id), user_id, status)
    end

    # Get user status
    def get_status(account_id, user_id)
      $redis.hget(status_key(account_id), user_id)
    end

    # Get all available users with their statuses
    def get_available_users(account_id)
      user_ids = get_available_user_ids(account_id)
      return {} if user_ids.blank?

      statuses = $redis.hmget(status_key(account_id), *user_ids)
      user_ids.each_with_index.to_h { |id, i| [id.to_s, statuses[i] || 'offline'] }
    end

    # Get available user IDs (present + persistent)
    def get_available_user_ids(account_id)
      range_start = (Time.zone.now - PRESENCE_DURATION).to_i
      present_ids = $redis.zrangebyscore(presence_key(account_id), range_start, '+inf')

      # Include users with auto_offline=false (always available)
      persistent_ids = AccountUser.where(account_id: account_id, auto_offline: false)
                                  .pluck(:user_id).map(&:to_s)

      (present_ids + persistent_ids).uniq
    end

    private

    def presence_key(account_id)
      "messaging:presence:#{account_id}"
    end

    def status_key(account_id)
      "messaging:status:#{account_id}"
    end
  end
end

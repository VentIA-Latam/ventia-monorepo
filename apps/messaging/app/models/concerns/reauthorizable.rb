module Reauthorizable
  extend ActiveSupport::Concern

  AUTHORIZATION_ERROR_THRESHOLD = 2

  def reauthorization_required?
    $redis.get(reauthorization_required_key).present?
  end

  def authorization_error_count
    $redis.get(authorization_error_count_key).to_i
  end

  def authorization_error!
    $redis.incr(authorization_error_count_key)
    prompt_reauthorization! if authorization_error_count >= self.class::AUTHORIZATION_ERROR_THRESHOLD
  end

  def prompt_reauthorization!
    $redis.set(reauthorization_required_key, true)
    Rails.logger.warn "[Reauthorizable] #{self.class.name} #{id} requires reauthorization"
  end

  def reauthorized!
    $redis.del(authorization_error_count_key)
    $redis.del(reauthorization_required_key)
  end

  private

  def authorization_error_count_key
    "authorization_error_count:#{self.class.table_name.singularize}:#{id}"
  end

  def reauthorization_required_key
    "reauthorization_required:#{self.class.table_name.singularize}:#{id}"
  end
end

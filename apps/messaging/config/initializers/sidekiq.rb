Sidekiq.configure_server do |config|
  config.redis = {
    url: ENV.fetch('REDIS_URL', 'redis://localhost:6379/1'),
    network_timeout: 5
  }

  # Enable cron-like scheduled jobs if needed
  # config.on(:startup) do
  #   require 'sidekiq-scheduler'
  # end
end

Sidekiq.configure_client do |config|
  config.redis = {
    url: ENV.fetch('REDIS_URL', 'redis://localhost:6379/1'),
    network_timeout: 5
  }
end

# Default retry configuration
Sidekiq.default_job_options = {
  retry: 3,
  dead: true
}

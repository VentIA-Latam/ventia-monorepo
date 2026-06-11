Sidekiq.configure_server do |config|
  config.redis = {
    url: ENV.fetch('REDIS_URL', 'redis://localhost:6379/1'),
    network_timeout: 5
  }

  # Load sidekiq-cron schedule from config/sidekiq-cron.yml.
  # Skipped en test env para no contaminar specs con cron real.
  config.on(:startup) do
    next if Rails.env.test?

    schedule_file = Rails.root.join('config', 'sidekiq-cron.yml')
    if File.exist?(schedule_file)
      Sidekiq::Cron::Job.load_from_hash!(YAML.load_file(schedule_file))
    end
  end
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

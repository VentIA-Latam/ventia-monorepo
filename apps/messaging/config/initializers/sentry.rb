Sentry.init do |config|
  config.dsn = ENV["SENTRY_DSN"]
  config.environment = Rails.env
  config.breadcrumbs_logger = [:active_support_logger, :http_logger]
  config.traces_sample_rate = Rails.env.production? ? 0.2 : 1.0
  config.send_default_pii = false
end if ENV["SENTRY_DSN"].present?

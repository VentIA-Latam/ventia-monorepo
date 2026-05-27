require "active_support/core_ext/integer/time"

Rails.application.configure do
  config.enable_reloading = false
  config.eager_load = true
  config.consider_all_requests_local = false

  # Caching
  config.cache_store = :redis_cache_store, {
    url: ENV.fetch('REDIS_URL'),
    namespace: 'messaging',
    expires_in: 1.hour
  }
  config.action_controller.perform_caching = true

  # Active Storage
  config.active_storage.service = :local

  # Force SSL unless behind reverse proxy (Nginx handles SSL termination)
  config.force_ssl = ENV['FORCE_SSL'] == 'true'

  # Logging
  config.log_level = ENV.fetch('LOG_LEVEL', 'info')
  config.log_tags = [:request_id]
  config.logger = ActiveSupport::Logger.new(STDOUT)

  # Background jobs
  config.active_job.verbose_enqueue_logs = false

  # I18n
  config.i18n.fallbacks = true

  # Deprecations
  config.active_support.report_deprecations = false

  # DNS rebinding protection
  config.hosts = ENV.fetch('ALLOWED_HOSTS', '').split(',')

  # ActionMailer — Resend SMTP relay
  config.action_mailer.delivery_method = :smtp
  config.action_mailer.smtp_settings = {
    address: 'smtp.resend.com',
    port: 465,
    user_name: 'resend',
    password: ENV.fetch('RESEND_API_KEY', ''),
    authentication: :plain,
    ssl: true
  }
  config.action_mailer.default_url_options = { host: ENV.fetch('FRONTEND_URL', 'https://app.ventia-latam.com') }
  config.action_mailer.perform_deliveries = true

  # Raise error when a before_action's only/except options reference missing actions
  config.action_controller.raise_on_missing_callback_actions = true

  # Public URL for external services (WhatsApp media links, etc.)
  Rails.application.routes.default_url_options = { host: ENV.fetch('MESSAGING_SERVICE_URL', 'https://ws.ventia-latam.com') }
end

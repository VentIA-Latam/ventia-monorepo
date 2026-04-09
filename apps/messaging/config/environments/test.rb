require "active_support/core_ext/integer/time"

Rails.application.configure do
  config.enable_reloading = false
  config.eager_load = ENV['CI'].present?
  config.consider_all_requests_local = true
  config.public_file_server.enabled = true
  config.public_file_server.headers = { "Cache-Control" => "public, max-age=#{1.hour.to_i}" }

  config.cache_store = :null_store
  config.action_controller.perform_caching = false
  config.action_controller.allow_forgery_protection = false

  # Active Storage
  config.active_storage.service = :test

  # Disable request forgery protection in test environment
  config.action_controller.allow_forgery_protection = false

  # Logging
  config.log_level = :warn
  config.logger = ActiveSupport::Logger.new(STDOUT)

  # Background jobs
  config.active_job.queue_adapter = :test
  config.active_job.verbose_enqueue_logs = false

  # Deprecations
  config.active_support.deprecation = :stderr
  config.active_support.disallowed_deprecation = :raise
  config.active_support.disallowed_deprecation_warnings = []

  # Raise error when a before_action's only/except options reference missing actions
  config.action_controller.raise_on_missing_callback_actions = true
end

require_relative "boot"

require "rails"
require "active_model/railtie"
require "active_job/railtie"
require "active_record/railtie"
require "active_storage/engine"
require "action_controller/railtie"
require "action_cable/engine"

# Require the gems listed in Gemfile
Bundler.require(*Rails.groups)

module MessagingService
  class Application < Rails::Application
    config.load_defaults 7.2

    # API-only mode
    config.api_only = true

    # Timezone and locale
    config.time_zone = 'UTC'
    config.i18n.default_locale = :en

    # Active Job
    config.active_job.queue_adapter = :sidekiq

    # Eager load paths
    config.eager_load_paths << Rails.root.join('lib')

    # Autoload paths
    config.autoload_paths << Rails.root.join('app', 'services')
    config.autoload_paths << Rails.root.join('app', 'jobs')
    config.autoload_paths << Rails.root.join('app', 'listeners')
    config.autoload_paths << Rails.root.join('app', 'builders')

    # CORS configuration
    config.middleware.insert_before 0, Rack::Cors do
      allow do
        origins ENV.fetch('CORS_ORIGINS', 'http://localhost:3000').split(',')
        resource '*',
          headers: :any,
          methods: [:get, :post, :put, :patch, :delete, :options, :head],
          credentials: true
      end
    end

    # Cache store
    config.cache_store = :redis_cache_store, {
      url: ENV.fetch('REDIS_URL', 'redis://localhost:6379/1'),
      namespace: 'messaging',
      expires_in: 1.hour
    }

    # Session store
    config.session_store :cache_store,
      key: '_messaging_session',
      same_site: :lax,
      secure: Rails.env.production?

    # ActionCable
    config.action_cable.mount_path = '/cable'
    config.action_cable.url = ENV.fetch('ACTION_CABLE_URL', 'ws://localhost:3001/cable')
    config.action_cable.allowed_request_origins = ENV.fetch('CORS_ORIGINS', 'http://localhost:3000').split(',')

    # Active Storage (for attachments)
    config.active_storage.variant_processor = :vips
    config.active_storage.queues.analysis = :active_storage_analysis
    config.active_storage.queues.purge = :active_storage_purge

    # Generators
    config.generators do |g|
      g.orm :active_record, primary_key_type: :uuid
      g.test_framework :rspec
      g.factory_bot dir: 'spec/factories'
    end
  end
end

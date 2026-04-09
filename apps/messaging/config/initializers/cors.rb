# CORS configuration is handled in config/application.rb
# This file exists for additional CORS customization if needed

Rails.application.config.middleware.insert_before 0, Rack::Cors do
  allow do
    origins ENV.fetch('CORS_ORIGINS', 'http://localhost:3000').split(',')

    resource '/api/*',
      headers: :any,
      methods: [:get, :post, :put, :patch, :delete, :options, :head],
      credentials: true,
      max_age: 600

    resource '/cable',
      headers: :any,
      methods: [:get, :post, :options],
      credentials: true
  end
end

require 'fcm'

FCM_CLIENT = if ENV['FIREBASE_ADMIN_PRIVATE_KEY'].present?
  # FCM gem 2.0 requires a JSON credentials source (file path or StringIO)
  credentials_json = {
    type: 'service_account',
    project_id: ENV.fetch('FIREBASE_ADMIN_PROJECT_ID'),
    client_email: ENV.fetch('FIREBASE_ADMIN_CLIENT_EMAIL'),
    private_key: ENV.fetch('FIREBASE_ADMIN_PRIVATE_KEY').gsub("\\n", "\n"),
    token_uri: 'https://oauth2.googleapis.com/token'
  }.to_json

  FCM.new(
    StringIO.new(credentials_json),
    ENV.fetch('FIREBASE_ADMIN_PROJECT_ID')
  )
else
  Rails.logger.warn "[FCM] Firebase credentials not configured - push notifications disabled"
  nil
end

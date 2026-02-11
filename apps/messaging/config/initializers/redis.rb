app_redis_config = {
  url: ENV.fetch('REDIS_URL', 'redis://localhost:6379/1'),
  timeout: 5
}

# Redis instance for general use (Redis.current removed in Redis 5.x)
$redis = Redis.new(app_redis_config)

# Separate Redis for ActionCable
ActionCable.server.config.cable = {
  adapter: 'redis',
  url: ENV.fetch('REDIS_URL', 'redis://localhost:6379/1'),
  channel_prefix: 'messaging_cable'
}

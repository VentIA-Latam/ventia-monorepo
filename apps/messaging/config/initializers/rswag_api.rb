# Require rswag gems
require 'rswag/api'

Rswag::Api.configure do |c|
  # Especificar dónde están los archivos swagger
  c.openapi_root = Rails.root.join('swagger').to_s
end

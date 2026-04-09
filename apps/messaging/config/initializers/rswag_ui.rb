# Require rswag gems
require 'rswag/ui'
require 'rswag/api'

Rswag::Ui.configure do |c|
  # Configuración de Swagger UI (MUST be set before openapi_endpoint)
  c.config_object = {
    deepLinking: true,
    displayRequestDuration: true,
    docExpansion: 'list',
    filter: true,
    showExtensions: true,
    showCommonExtensions: true,
    syntaxHighlight: {
      activate: true,
      theme: 'monokai'
    }
  }

  # Add OpenAPI endpoint AFTER config_object (this adds to config_object[:urls])
  c.openapi_endpoint '/api-docs/v1/swagger.yaml', 'Ventia Messaging API V1'
end

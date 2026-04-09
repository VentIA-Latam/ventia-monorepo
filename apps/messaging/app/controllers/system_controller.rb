class SystemController < ApplicationController
  # Skip authentication for system routes
  skip_before_action :verify_authenticity_token

  def index
    render json: {
      service: "Ventia Messaging Service",
      version: "1.0.0",
      description: "WhatsApp messaging, automation, campaigns & webhooks",
      documentation: "/api-docs",
      health: "/health"
    }
  end

  def health
    render json: {
      status: "healthy",
      service: "messaging",
      timestamp: Time.current.iso8601
    }
  end
end

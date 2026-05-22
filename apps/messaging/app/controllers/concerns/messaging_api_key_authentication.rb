module MessagingApiKeyAuthentication
  extend ActiveSupport::Concern

  included do
    before_action :authenticate_messaging_service!
  end

  private

  def authenticate_messaging_service!
    expected = ENV['MESSAGING_SERVICE_API_KEY'].to_s

    if expected.blank?
      render json: { error: 'MESSAGING_SERVICE_API_KEY not configured' },
             status: :internal_server_error
      return
    end

    provided = request.headers['X-API-Key'].to_s

    valid = provided.bytesize == expected.bytesize &&
            ActiveSupport::SecurityUtils.secure_compare(expected, provided)

    return if valid

    render json: { error: 'Invalid or missing API key' }, status: :unauthorized
  end
end

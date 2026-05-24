class Api::V1::BaseController < ApplicationController
  include MessagingApiKeyAuthentication

  before_action :set_current_account
  before_action :set_current_user
  before_action :set_sentry_context

  private

  def set_current_account
    tenant_id = request.headers['X-Tenant-Id'] || params[:tenant_id]

    if tenant_id.present?
      @current_account = Account.find_by(ventia_tenant_id: tenant_id)

      unless @current_account
        render json: { error: 'Account not found for tenant' }, status: :not_found
      end
    else
      render json: { error: 'Tenant ID required' }, status: :unauthorized
    end
  end

  def set_current_user
    ventia_user_id = request.headers['X-User-Id']
    return unless ventia_user_id.present?

    @current_user = User.find_by(ventia_user_id: ventia_user_id)
    Current.user = @current_user
  end

  def current_account
    @current_account
  end

  def current_user
    @current_user
  end

  def render_success(data, message: nil, status: :ok)
    response = { success: true }
    response[:message] = message if message
    response[:data] = data if data

    render json: response, status: status
  end

  def render_error(message, errors: nil, status: :unprocessable_entity)
    response = { success: false, error: message }
    response[:errors] = errors if errors

    render json: response, status: status
  end

  def pagination_meta(collection)
    {
      current_page: collection.current_page,
      next_page: collection.next_page,
      prev_page: collection.prev_page,
      total_pages: collection.total_pages,
      total_count: collection.total_count
    }
  end

  def set_sentry_context
    return unless Sentry.initialized?

    Sentry.set_user(id: @current_user&.id, email: @current_user&.email) if @current_user
    Sentry.set_tags(tenant_id: @current_account&.ventia_tenant_id) if @current_account
  end
end
